import { Injectable, Logger } from '@nestjs/common';

/**
 * Seyahat koşulları — her alan opsiyonel. Verilmeyen koşullar "nötr" kabul
 * edilir (k-factor = 1.0).
 */
export interface TripConditions {
  /** Otoyol seyir hızı (km/s). */
  speedKph?: number;

  /** Trafik faktörü için: rota mesafesi (km) + süre (s). */
  distanceKm?: number;
  durationSeconds?: number;

  /** Klima açık mı? default true. */
  acOn?: boolean;
  /** Dış ortam sıcaklığı (°C). default 20. AC yükünü ve hava yoğunluğunu etkiler. */
  ambientTempC?: number;

  /** Motor hacmi (L). default 1.6. Motor gücü proxy'si. */
  engineDisplacementL?: number;

  /** Araç curb weight (kg). default 1500. */
  vehicleMassKg?: number;
  /** Ekstra yük: yolcu + bagaj (kg). default 0. */
  extraLoadKg?: number;

  /** Rotanın net tırmanışı (m). Yokuş yukarı toplam. default 0. */
  elevationGainM?: number;

  /** Baş rüzgâr bileşeni (km/s). + headwind, – tailwind. default 0. */
  headwindKph?: number;

  /** Yağmur şiddeti 0-3 (0 kuru, 1 çiseleme, 2 orta, 3 şiddetli). default 0. */
  rainLevel?: 0 | 1 | 2 | 3;

  /** Backward-compat: `acOn` ile aynı anlama gelir, verilirse kullanılır. */
  hasClimateControl?: boolean;
}

/** Her bir k-factor + bileşim — debug ve UI breakdown için. */
export interface ConsumptionFactors {
  speed: number;
  ac: number;
  temperature: number;
  wind: number;
  elevation: number;
  load: number;
  rain: number;
  traffic: number;
  /** Tüm faktörlerin çarpımı — baseL100'ü bununla çarpıp gerçek L/100km'yi al. */
  combined: number;

  // Backward-compat aliases (eski kod bu isimleri bekleyebilir)
  speedFactor: number;
  acFactor: number;
  trafficFactor: number;
  climateFactor: number;
}

/**
 * FuelCalculatorService
 * ---------------------------------------------------------------------------
 * Yakıt tüketimine etki eden çevresel faktörlerin merkezi, fizik-tabanlı
 * hesaplama servisi.
 *
 * Her k-factor bağımsız bir fiziksel prensipten türüyor:
 *   • speed       → rolling resistance + aerodynamic drag (v²)
 *   • ac          → compressor power / engine cruise power
 *   • temperature → air density & engine warm-up (şimdilik sadece density)
 *   • wind        → effective aero speed (v + vw)²
 *   • elevation   → potential energy work (m·g·Δh)
 *   • load        → rolling + climb work scales with mass
 *   • rain        → tire-road friction + slower driving (empirik)
 *   • traffic     → stop-and-go transient verimsizlik (ortalama hız proxy)
 *
 * Nötr koşulda (speed=90, T=20°C, flat, no wind, no load, no rain, highway)
 * tüm k-factor'ler 1.0 → combined = 1.0 → araç EPA combined cycle'ındaki gibi
 * yakar.
 *
 * Kaynaklar & kalibrasyon notu:
 *   - Rolling/aero split (%60/%40 @ 90 kph): mid-size sedan için ADAC verisi
 *   - AC compressor 0.5-3 kW: SAE J2765 + R-134a soğutma çevrimi teoremi
 *   - Drivetrain efficiency 85%: otomatik şanzıman + diferansiyel
 *   - ICE brake efficiency 25%: ortalama benzinli motor (dizelde ~35%)
 *
 * Tüm sabitler `Tunables` içinde toplu; ileride ML kalibrasyonu geldiğinde
 * bu struct'ı ekstern JSON'dan yüklemek tek değişiklik olacak.
 */
@Injectable()
export class FuelCalculatorService {
  private readonly logger = new Logger(FuelCalculatorService.name);

  // ───────────────────────── FİZİK SABİTLERİ ─────────────────────────────
  private static readonly Tunables = {
    // Speed model: referans hızda rolling/aero yakıt payı
    // Not: saf v² modeli ADAC gerçek dünya verisine göre yüksek hızlarda
    // overshoot yapıyordu (130 kph'de +43% göstiyordu, gerçek ~+22%). Rolling
    // share'i 0.75'e çektik + exponent'i 1.8'e düşürdük → sedan cruise data'sına
    // çok daha yakın:  90→1.00, 110→1.11, 130→1.23, 140→1.29
    SPEED_REF_KPH: 90,
    ROLLING_SHARE: 0.75,
    AERO_SHARE: 0.25,
    AERO_EXPONENT: 1.8,
    SPEED_MIN: 0.80,
    SPEED_MAX: 1.40,     // clamp — ultra high speed penalty reasonable

    // AC compressor model: P_ac = base + slope·(T - baseline), clamp [base, max]
    AC_BASE_KW: 0.4,           // kompresör clutch + fan minimum
    AC_TEMP_BASELINE_C: 18,    // bu sıcaklığın altında AC ihmal edilir
    AC_TEMP_SLOPE_KW_PER_C: 0.08, // her +1°C için ek kompresör yükü
    AC_MAX_KW: 3.5,            // aşırı sıcakta plateau
    AC_IMPACT_MAX: 0.35,       // %35 üzeri anlamsız — safety clamp

    // Engine power proxy: P_eng ≈ base + α·v² + β·displacement
    ENG_IDLE_KW: 3.0,          // idle + accessories
    ENG_V2_COEF: 0.0022,       // sedan için; 100 kph → +22 kW
    ENG_DISPLACEMENT_COEF: 1.5, // her L motor için +1.5 kW cruise baseline
    DRIVETRAIN_EFF: 0.85,      // %15 kayıp @ otomatik

    // Air density (temperature affects aero drag)
    AIR_DENSITY_REF_C: 20,
    AIR_DENSITY_PCT_PER_C: -0.0034, // ideal gas: ρ ∝ 1/T; ~-0.34%/°C around 20°C

    // Elevation: potential energy / fuel energy
    // Not: Ham cumulative climb kullanmak overshoot yapıyor çünkü gerçek dünyada
    // araç iniş kısımlarında yakıt yakmıyor (engine braking, coast down) →
    // tırmanışın büyük kısmı "geri kazanılıyor". DESCENT_RECOVERY: inişlerde
    // enerjinin ne kadarı "bedava" (yakıt yakılmıyor). 0.75 = iniş sırasında
    // %75 bedava kazanıyorsun, effective climb = climb * (1-0.75) = climb/4.
    GRAVITY_MS2: 9.81,
    FUEL_ENERGY_MJ_PER_L: 32.0,   // benzin alt ısıl değer (dizel 36, LPG 25)
    ENGINE_BRAKE_EFF: 0.25,       // ICE ortalama brake verimliliği
    DESCENT_RECOVERY: 0.75,       // inişte kurtarılan % (0 = hiç, 1 = tamamı)
    ELEV_FACTOR_MAX: 1.20,        // clamp — ≥%20 extra tek başına ayrı işaret

    // Load: her 100 kg için rolling + climb yakıt cezası
    LOAD_PCT_PER_100KG: 0.05,     // %5 @ 100kg (rolling ∝ m, climb ∝ m)
    DEFAULT_VEHICLE_MASS_KG: 1500,

    // Rain: yüzey sürtünmesi + sürücü yavaşlaması
    RAIN_FACTORS: [1.0, 1.03, 1.07, 1.12] as const, // [dry, drizzle, moderate, heavy]

    // Traffic (avg speed-based)
    TRAFFIC_HIGHWAY_KPH: 100,
    TRAFFIC_NORMAL_KPH: 70,
    TRAFFIC_CITY_KPH: 40,
    TRAFFIC_FACTORS: {
      highway: 0.90,
      normal: 1.00,
      city: 1.15,
      jam: 1.30,
    },
  };

  // ─────────────────────────── FACTORS ───────────────────────────────────

  /**
   * Hız faktörü — (rolling + aero) güç ayrışımına dayalı.
   *
   *   P(v) / P(v_ref) ≈ rolling_share + aero_share · (v/v_ref)²
   *
   * 90 kph referans alındı (Türkiye otoyol normali). Rolling resistance hızla
   * ~linear artar ama v² aero dominant hale geldikçe fuel eğrisi super-linear
   * olur.
   *
   *   80  → 0.92   |  110 → 1.20
   *   90  → 1.00   |  120 → 1.31
   *   100 → 1.09   |  130 → 1.43
   *                |  140 → 1.57
   */
  speedFactor(speedKph?: number): number {
    const { SPEED_REF_KPH, ROLLING_SHARE, AERO_SHARE, AERO_EXPONENT, SPEED_MIN, SPEED_MAX } =
      FuelCalculatorService.Tunables;
    if (!speedKph || speedKph <= 0) return 1.0;
    const ratio = speedKph / SPEED_REF_KPH;
    // Güç mix: rolling (lineer'e yakın) + aero (v^1.8). ADAC data ile kalibre.
    const raw = ROLLING_SHARE + AERO_SHARE * Math.pow(ratio, AERO_EXPONENT);
    return Math.max(SPEED_MIN, Math.min(SPEED_MAX, raw));
  }

  /**
   * Klima faktörü — kompresör gücü / motor cruise gücü oranı.
   *
   *   P_ac(T) = clamp( AC_BASE + slope·(T - baseline), BASE, MAX )
   *   P_eng(v, disp) = IDLE + α·v² + β·disp
   *   k_ac = 1 + P_ac / (P_eng · η_drivetrain)
   *
   * Neden önemli: Aynı AC yükü şehir içinde (P_eng=8kW) %25, otoyolda
   * (P_eng=25kW) %6 etki yapıyor. Hıza ve sıcaklığa birlikte duyarlı.
   */
  acFactor(params: {
    acOn?: boolean;
    ambientTempC?: number;
    speedKph?: number;
    engineDisplacementL?: number;
  }): number {
    const T = FuelCalculatorService.Tunables;
    if (params.acOn === false) return 1.0;

    const tempC = params.ambientTempC ?? 20;
    const speed = params.speedKph ?? T.SPEED_REF_KPH;
    const disp = params.engineDisplacementL ?? 1.6;

    // AC kompresör mekanik yükü (kW)
    const deltaT = Math.max(0, tempC - T.AC_TEMP_BASELINE_C);
    const pAcKw = Math.min(
      T.AC_MAX_KW,
      T.AC_BASE_KW + T.AC_TEMP_SLOPE_KW_PER_C * deltaT,
    );

    // Motor cruise gücü (kW)
    const pEngKw =
      T.ENG_IDLE_KW +
      T.ENG_V2_COEF * speed * speed +
      T.ENG_DISPLACEMENT_COEF * disp;

    // AC'nin motor çıktısına göre göreceli yükü
    const impact = pAcKw / (pEngKw * T.DRIVETRAIN_EFF);
    return 1.0 + Math.min(T.AC_IMPACT_MAX, impact);
  }

  /**
   * Hava sıcaklığı → hava yoğunluğu → aero drag.
   * ρ(T) ∝ 1/T (ideal gas). Aero payı (AERO_SHARE) bu oranla ölçeklenir.
   *
   *   30°C → ~%0.3 daha az drag → %0.1 daha az yakıt (çok küçük)
   *   0°C  → ~%7 daha fazla drag → %3 daha fazla yakıt
   *   -10°C → %10+ daha fazla yakıt (warm-up etkisi dahil değil)
   *
   * NOT: Bu sadece aero drag üzerinden. Soğuk başlatma yakıt cezası (katalitik
   * konvertör ısınması, viskoz yağ) burada YOK — çünkü bu trip-başı-bir-kere
   * efekti ve mesafe uzadıkça dağılıyor. Gelecekte distanceKm-bağımlı ayrı
   * bir `coldStartFactor` eklenebilir.
   */
  temperatureFactor(ambientTempC?: number): number {
    const { AIR_DENSITY_REF_C, AIR_DENSITY_PCT_PER_C, AERO_SHARE, ROLLING_SHARE } =
      FuelCalculatorService.Tunables;
    if (ambientTempC === undefined) return 1.0;
    const densityDelta = AIR_DENSITY_PCT_PER_C * (ambientTempC - AIR_DENSITY_REF_C);
    // Aero payı yoğunlukla doğru orantılı, rolling payı değişmez
    return ROLLING_SHARE + AERO_SHARE * (1 + densityDelta);
  }

  /**
   * Rüzgâr faktörü — aero drag ∝ v_relative². Rolling payı değişmez.
   *
   *   100 kph + 20 kph headwind → v_rel = 120 kph → aero payı ×1.44
   *   100 kph + 20 kph tailwind → v_rel = 80 kph  → aero payı ×0.64
   *
   * Tailwind clamp [0, ∞) — anlamsız negatife düşmesin.
   */
  windFactor(speedKph?: number, headwindKph?: number): number {
    const { ROLLING_SHARE, AERO_SHARE } = FuelCalculatorService.Tunables;
    if (!speedKph || speedKph <= 0) return 1.0;
    const vw = headwindKph ?? 0;
    const vRel = Math.max(0, speedKph + vw);
    const ratio2 = (vRel / speedKph) ** 2;
    return ROLLING_SHARE + AERO_SHARE * ratio2;
  }

  /**
   * Yükseklik kazanımı faktörü — potansiyel enerji işi.
   *
   *   E_climb = m · g · Δh   (Joule)
   *   L_climb = E_climb / (η_engine · ρ_fuel_energy)
   *   k_elev  = 1 + L_climb / L_baseline
   *
   * Örnek: 1500 kg + 500 m tırmanış + 100 km rota + 7 L/100 baseline
   *   E = 1500·9.81·500 = 7.36 MJ
   *   L_extra = 7.36 / 0.25 / 32 = 0.92 L
   *   L_base  = 7 L
   *   k_elev  = 1 + 0.92/7 = 1.13  (+%13)
   *
   * İnişlerin "bedava" olduğunu varsayıyoruz (engine braking, downhill coast).
   * Net climb = toplam yokuşun ham toplamı, descent karşılığı yok.
   */
  elevationFactor(params: {
    elevationGainM?: number;
    distanceKm?: number;
    massKg?: number;
    baseL100?: number;
  }): number {
    const { GRAVITY_MS2, FUEL_ENERGY_MJ_PER_L, ENGINE_BRAKE_EFF, DESCENT_RECOVERY, ELEV_FACTOR_MAX } =
      FuelCalculatorService.Tunables;
    const climb = params.elevationGainM ?? 0;
    const dist = params.distanceKm ?? 0;
    if (climb <= 0 || dist <= 0) return 1.0;

    const mass = params.massKg ?? FuelCalculatorService.Tunables.DEFAULT_VEHICLE_MASS_KG;
    const baseL100 = params.baseL100 ?? 7.5;

    // Etkili tırmanış = ham climb × (1 - descent_recovery).
    // Gerekçe: bir rotanın tırmanış toplamının büyük kısmı dengi iniş toplamıyla
    // eşleşiyor. İnişte yakıt yakılmıyor (engine braking, coast). Dolayısıyla net
    // "ek yakıt harcaması" cumulative climb'in küçük bir yüzdesi.
    const effectiveClimb = climb * (1 - DESCENT_RECOVERY);

    const eClimbMj = (mass * GRAVITY_MS2 * effectiveClimb) / 1_000_000;
    const lExtra = eClimbMj / (ENGINE_BRAKE_EFF * FUEL_ENERGY_MJ_PER_L);
    const lBase = (dist * baseL100) / 100;
    if (lBase <= 0) return 1.0;
    const raw = 1.0 + lExtra / lBase;
    return Math.min(ELEV_FACTOR_MAX, raw);
  }

  /**
   * Yük faktörü — ek kütle rolling resistance ve varsa climb işini artırır.
   *
   *   %5 yakıt cezası / her 100 kg (empirik, ADAC)
   *
   * 80 kg yolcu ≈ %4 ek yakıt. 3 yolcu + bagaj (300 kg) ≈ %15.
   */
  loadFactor(extraLoadKg?: number): number {
    const { LOAD_PCT_PER_100KG } = FuelCalculatorService.Tunables;
    if (!extraLoadKg || extraLoadKg <= 0) return 1.0;
    return 1.0 + (extraLoadKg / 100) * LOAD_PCT_PER_100KG;
  }

  /**
   * Yağmur faktörü — yüzey sürtünmesi + sürücünün hız düşürmesi.
   *
   *   0 kuru       → ×1.00
   *   1 çiseleme   → ×1.03
   *   2 orta yağış → ×1.07
   *   3 şiddetli   → ×1.12
   */
  rainFactor(level?: 0 | 1 | 2 | 3): number {
    const { RAIN_FACTORS } = FuelCalculatorService.Tunables;
    return RAIN_FACTORS[level ?? 0];
  }

  /**
   * Trafik faktörü — rota mesafesi / süresinden ortalama hız türet, bant'a
   * göre klasör. (FuelAiService'ten buraya taşındı.)
   */
  trafficFactor(durationSeconds?: number, distanceKm?: number): number {
    const { TRAFFIC_HIGHWAY_KPH, TRAFFIC_NORMAL_KPH, TRAFFIC_CITY_KPH, TRAFFIC_FACTORS } =
      FuelCalculatorService.Tunables;
    if (!durationSeconds || durationSeconds <= 0 || !distanceKm || distanceKm <= 0) {
      return TRAFFIC_FACTORS.normal;
    }
    const avgKph = (distanceKm / durationSeconds) * 3600;
    if (avgKph > TRAFFIC_HIGHWAY_KPH) return TRAFFIC_FACTORS.highway;
    if (avgKph > TRAFFIC_NORMAL_KPH) return TRAFFIC_FACTORS.normal;
    if (avgKph > TRAFFIC_CITY_KPH) return TRAFFIC_FACTORS.city;
    return TRAFFIC_FACTORS.jam;
  }

  // ─────────────────────────── COMBINE ───────────────────────────────────

  /**
   * Tüm faktörleri hesapla ve çarpımlarını döndür.
   *
   * Kullanım:
   *   const factors = calc.combinedFactor({ speedKph: 120, acOn: true, ambientTempC: 32 });
   *   const actualL100 = baseL100 * factors.combined;
   */
  combinedFactor(cond: TripConditions & { baseL100?: number }): ConsumptionFactors {
    // backward-compat: hasClimateControl → acOn
    const acOn = cond.acOn ?? cond.hasClimateControl ?? true;

    this.logger.log(
      `[FuelCalc] IN: speed=${cond.speedKph ?? '—'} kph, ac=${acOn ? 'on' : 'off'}, ` +
      `temp=${cond.ambientTempC ?? '—'}°C, wind=${cond.headwindKph?.toFixed(1) ?? '—'} kph, ` +
      `rain=${cond.rainLevel ?? '—'}, elev=${cond.elevationGainM?.toFixed(0) ?? '—'}m, ` +
      `load=${cond.extraLoadKg ?? 0}kg, disp=${cond.engineDisplacementL ?? 1.6}L, ` +
      `dist=${cond.distanceKm?.toFixed(0) ?? '—'}km, dur=${cond.durationSeconds ?? '—'}s, ` +
      `baseL100=${cond.baseL100 ?? 7.5}`,
    );

    const speed = this.speedFactor(cond.speedKph);
    const ac = this.acFactor({
      acOn,
      ambientTempC: cond.ambientTempC,
      speedKph: cond.speedKph,
      engineDisplacementL: cond.engineDisplacementL,
    });
    const temperature = this.temperatureFactor(cond.ambientTempC);
    const wind = this.windFactor(cond.speedKph, cond.headwindKph);
    const mass = (cond.vehicleMassKg ?? FuelCalculatorService.Tunables.DEFAULT_VEHICLE_MASS_KG) +
                 (cond.extraLoadKg ?? 0);
    const elevation = this.elevationFactor({
      elevationGainM: cond.elevationGainM,
      distanceKm: cond.distanceKm,
      massKg: mass,
      baseL100: cond.baseL100,
    });
    const load = this.loadFactor(cond.extraLoadKg);
    const rain = this.rainFactor(cond.rainLevel);
    const traffic = this.trafficFactor(cond.durationSeconds, cond.distanceKm);

    const combined = speed * ac * temperature * wind * elevation * load * rain * traffic;
    const pctDelta = ((combined - 1) * 100).toFixed(1);

    // Her faktörü ayrı satırla yazdır — hangilerinin dominant olduğu net görünür
    this.logger.log(
      `[FuelCalc] FACTORS: speed=${speed.toFixed(3)} · ac=${ac.toFixed(3)} · ` +
      `temp=${temperature.toFixed(3)} · wind=${wind.toFixed(3)} · ` +
      `elev=${elevation.toFixed(3)} · load=${load.toFixed(3)} · ` +
      `rain=${rain.toFixed(3)} · traffic=${traffic.toFixed(3)}`,
    );
    this.logger.log(
      `[FuelCalc] → COMBINED = ${combined.toFixed(3)}  (${pctDelta}% vs nötr baseline)`,
    );

    return {
      speed,
      ac,
      temperature,
      wind,
      elevation,
      load,
      rain,
      traffic,
      combined,
      // backward-compat aliases
      speedFactor: speed,
      acFactor: ac,
      trafficFactor: traffic,
      climateFactor: ac,
    };
  }

  /**
   * Backward-compat: eski `climateControlFactor(hasClimateControl: bool)`
   * çağrıları için. Yeni kod acFactor(...) objesi kullansın.
   */
  climateControlFactor(hasClimateControl: boolean, engineDisplacementL = 1.6): number {
    return this.acFactor({ acOn: hasClimateControl, engineDisplacementL });
  }
}

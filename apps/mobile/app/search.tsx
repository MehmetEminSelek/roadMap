import { useState, useRef, useEffect, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TextInput,
    TouchableOpacity,
    FlatList,
    Keyboard,
    Platform,
    ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import { ArrowLeft, MapPin, Navigation, Repeat2, Clock, X } from 'lucide-react-native';
import axios from 'axios';

const GOOGLE_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || '';

interface PlacePrediction {
    place_id: string;
    description: string;
    structured_formatting: {
        main_text: string;
        secondary_text: string;
    };
}

export default function SearchScreen() {
    const originRef = useRef<TextInput>(null);
    const destRef = useRef<TextInput>(null);
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const [origin, setOrigin] = useState('');
    const [destination, setDestination] = useState('');
    const [activeField, setActiveField] = useState<'origin' | 'destination'>('destination');
    const [predictions, setPredictions] = useState<PlacePrediction[]>([]);
    const [searching, setSearching] = useState(false);

    useEffect(() => {
        setTimeout(() => destRef.current?.focus(), 300);
    }, []);

    const searchPlaces = useCallback((query: string) => {
        if (debounceRef.current) clearTimeout(debounceRef.current);

        if (query.length < 2) {
            setPredictions([]);
            return;
        }

        debounceRef.current = setTimeout(async () => {
            setSearching(true);
            try {
                const response = await axios.get(
                    'https://maps.googleapis.com/maps/api/place/autocomplete/json',
                    {
                        params: {
                            input: query,
                            key: GOOGLE_API_KEY,
                            language: 'tr',
                            components: 'country:tr',
                            types: 'geocode|establishment',
                        },
                    },
                );
                if (response.data.status === 'OK') {
                    setPredictions(response.data.predictions);
                } else {
                    setPredictions([]);
                }
            } catch (err) {
                console.error('Places autocomplete error:', err);
                setPredictions([]);
            } finally {
                setSearching(false);
            }
        }, 300);
    }, []);

    const handleOriginChange = (text: string) => {
        setOrigin(text);
        if (activeField === 'origin') searchPlaces(text);
    };

    const handleDestinationChange = (text: string) => {
        setDestination(text);
        if (activeField === 'destination') searchPlaces(text);
    };

    const handleSelectPrediction = (prediction: PlacePrediction) => {
        const name = prediction.structured_formatting.main_text;
        if (activeField === 'origin') {
            setOrigin(name);
            setPredictions([]);
            setActiveField('destination');
            setTimeout(() => destRef.current?.focus(), 100);
        } else {
            setDestination(name);
            setPredictions([]);
        }
    };

    const handleSwap = () => {
        const tmp = origin;
        setOrigin(destination);
        setDestination(tmp);
    };

    const handleClear = (field: 'origin' | 'destination') => {
        if (field === 'origin') {
            setOrigin('');
            originRef.current?.focus();
            setActiveField('origin');
        } else {
            setDestination('');
            destRef.current?.focus();
            setActiveField('destination');
        }
        setPredictions([]);
    };

    const handleCalculate = () => {
        if (!origin.trim() || !destination.trim()) return;
        Keyboard.dismiss();
        router.push({
            pathname: '/(tabs)/calculate',
            params: {
                origin: origin.trim(),
                destination: destination.trim(),
            },
        });
    };

    const canCalculate = origin.trim().length > 0 && destination.trim().length > 0;

    // Quick cities when no search active
    const quickCities = [
        { id: '1', name: 'İstanbul', detail: 'İstanbul, Türkiye' },
        { id: '2', name: 'Ankara', detail: 'Ankara, Türkiye' },
        { id: '3', name: 'İzmir', detail: 'İzmir, Türkiye' },
        { id: '4', name: 'Antalya', detail: 'Antalya, Türkiye' },
        { id: '5', name: 'Bursa', detail: 'Bursa, Türkiye' },
        { id: '6', name: 'Trabzon', detail: 'Trabzon, Türkiye' },
    ];

    const showPredictions = predictions.length > 0;
    const activeQuery = activeField === 'origin' ? origin : destination;

    return (
        <View style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
                    <ArrowLeft size={24} color="#202124" />
                </TouchableOpacity>

                <View style={styles.inputsContainer}>
                    {/* Origin */}
                    <View style={styles.inputRow}>
                        <View style={[styles.dot, styles.dotBlue]} />
                        <TextInput
                            ref={originRef}
                            style={[
                                styles.input,
                                activeField === 'origin' && styles.inputActive,
                            ]}
                            placeholder="Konumunuz"
                            placeholderTextColor="#9AA0A6"
                            value={origin}
                            onChangeText={handleOriginChange}
                            onFocus={() => {
                                setActiveField('origin');
                                if (origin.length >= 2) searchPlaces(origin);
                            }}
                            returnKeyType="next"
                            onSubmitEditing={() => destRef.current?.focus()}
                        />
                        {origin.length > 0 && (
                            <TouchableOpacity
                                style={styles.clearButton}
                                onPress={() => handleClear('origin')}
                            >
                                <X size={16} color="#9AA0A6" />
                            </TouchableOpacity>
                        )}
                    </View>

                    <View style={styles.inputDivider} />

                    {/* Destination */}
                    <View style={styles.inputRow}>
                        <View style={[styles.dot, styles.dotRed]} />
                        <TextInput
                            ref={destRef}
                            style={[
                                styles.input,
                                activeField === 'destination' && styles.inputActive,
                            ]}
                            placeholder="Nereye gitmek istiyorsun?"
                            placeholderTextColor="#9AA0A6"
                            value={destination}
                            onChangeText={handleDestinationChange}
                            onFocus={() => {
                                setActiveField('destination');
                                if (destination.length >= 2) searchPlaces(destination);
                            }}
                            returnKeyType="search"
                            onSubmitEditing={handleCalculate}
                        />
                        {destination.length > 0 && (
                            <TouchableOpacity
                                style={styles.clearButton}
                                onPress={() => handleClear('destination')}
                            >
                                <X size={16} color="#9AA0A6" />
                            </TouchableOpacity>
                        )}
                    </View>
                </View>

                <TouchableOpacity style={styles.swapButton} onPress={handleSwap}>
                    <Repeat2 size={20} color="#5F6368" />
                </TouchableOpacity>
            </View>

            {/* Results */}
            <View style={styles.resultsContainer}>
                {searching && (
                    <View style={styles.searchingRow}>
                        <ActivityIndicator size="small" color="#4285F4" />
                        <Text style={styles.searchingText}>Aranıyor...</Text>
                    </View>
                )}

                {showPredictions ? (
                    <FlatList
                        data={predictions}
                        keyExtractor={(item) => item.place_id}
                        keyboardShouldPersistTaps="handled"
                        renderItem={({ item }) => (
                            <TouchableOpacity
                                style={styles.predictionItem}
                                onPress={() => handleSelectPrediction(item)}
                            >
                                <View style={styles.predictionIcon}>
                                    <MapPin size={18} color="#5F6368" />
                                </View>
                                <View style={styles.predictionInfo}>
                                    <Text style={styles.predictionMain} numberOfLines={1}>
                                        {item.structured_formatting.main_text}
                                    </Text>
                                    <Text style={styles.predictionSecondary} numberOfLines={1}>
                                        {item.structured_formatting.secondary_text}
                                    </Text>
                                </View>
                            </TouchableOpacity>
                        )}
                    />
                ) : activeQuery.length < 2 ? (
                    <>
                        <Text style={styles.sectionTitle}>POPÜLER ŞEHIRLER</Text>
                        <FlatList
                            data={quickCities}
                            keyExtractor={(item) => item.id}
                            keyboardShouldPersistTaps="handled"
                            renderItem={({ item }) => (
                                <TouchableOpacity
                                    style={styles.predictionItem}
                                    onPress={() => handleSelectPrediction({
                                        place_id: item.id,
                                        description: item.detail,
                                        structured_formatting: {
                                            main_text: item.name,
                                            secondary_text: item.detail,
                                        },
                                    })}
                                >
                                    <View style={styles.predictionIcon}>
                                        <Clock size={18} color="#9AA0A6" />
                                    </View>
                                    <View style={styles.predictionInfo}>
                                        <Text style={styles.predictionMain}>{item.name}</Text>
                                        <Text style={styles.predictionSecondary}>{item.detail}</Text>
                                    </View>
                                </TouchableOpacity>
                            )}
                        />
                    </>
                ) : null}
            </View>

            {/* Bottom Bar */}
            {canCalculate && (
                <View style={styles.bottomBar}>
                    <TouchableOpacity style={styles.calculateButton} onPress={handleCalculate}>
                        <Navigation size={20} color="#FFF" />
                        <Text style={styles.calculateButtonText}>Rota Hesapla</Text>
                    </TouchableOpacity>
                </View>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#FFFFFF',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingTop: Platform.OS === 'ios' ? 60 : 40,
        paddingHorizontal: 8,
        paddingBottom: 12,
        backgroundColor: '#FFFFFF',
        borderBottomWidth: 1,
        borderBottomColor: '#E8EAED',
    },
    backButton: {
        padding: 10,
    },
    inputsContainer: {
        flex: 1,
        backgroundColor: '#F1F3F4',
        borderRadius: 12,
        marginHorizontal: 4,
    },
    inputRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
    },
    dot: {
        width: 10,
        height: 10,
        borderRadius: 5,
        marginRight: 12,
    },
    dotBlue: {
        backgroundColor: '#4285F4',
    },
    dotRed: {
        backgroundColor: '#EA4335',
    },
    input: {
        flex: 1,
        fontSize: 15,
        color: '#202124',
        paddingVertical: 12,
    },
    inputActive: {
        fontWeight: '500',
    },
    inputDivider: {
        height: 1,
        backgroundColor: '#DADCE0',
        marginLeft: 34,
        marginRight: 12,
    },
    clearButton: {
        padding: 6,
    },
    swapButton: {
        padding: 10,
    },
    resultsContainer: {
        flex: 1,
    },
    searchingRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        paddingHorizontal: 20,
        paddingVertical: 14,
    },
    searchingText: {
        fontSize: 14,
        color: '#5F6368',
    },
    sectionTitle: {
        fontSize: 12,
        fontWeight: '600',
        color: '#5F6368',
        paddingHorizontal: 20,
        paddingTop: 16,
        paddingBottom: 8,
        letterSpacing: 0.8,
    },
    predictionItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingVertical: 13,
        borderBottomWidth: 0.5,
        borderBottomColor: '#F1F3F4',
    },
    predictionIcon: {
        width: 38,
        height: 38,
        borderRadius: 19,
        backgroundColor: '#F1F3F4',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 14,
    },
    predictionInfo: {
        flex: 1,
    },
    predictionMain: {
        fontSize: 15,
        fontWeight: '500',
        color: '#202124',
        marginBottom: 2,
    },
    predictionSecondary: {
        fontSize: 13,
        color: '#5F6368',
    },
    bottomBar: {
        padding: 16,
        paddingBottom: Platform.OS === 'ios' ? 34 : 16,
        backgroundColor: '#FFFFFF',
        borderTopWidth: 1,
        borderTopColor: '#E8EAED',
    },
    calculateButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#4285F4',
        paddingVertical: 16,
        borderRadius: 28,
        gap: 10,
        shadowColor: '#4285F4',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 5,
    },
    calculateButtonText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#FFFFFF',
    },
});

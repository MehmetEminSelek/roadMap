import apiClient from './apiClient';
import type { Vehicle, CreateVehicleRequest, Brand, VehicleModel } from '@/types/api';

export const vehicleService = {
  async getAll(): Promise<Vehicle[]> {
    const response = await apiClient.get<Vehicle[]>('/vehicles');
    return response.data;
  },

  async getOne(id: string): Promise<Vehicle> {
    const response = await apiClient.get<Vehicle>(`/vehicles/${id}`);
    return response.data;
  },

  async create(data: CreateVehicleRequest): Promise<Vehicle> {
    const response = await apiClient.post<Vehicle>('/vehicles', data);
    return response.data;
  },

  async update(id: string, data: Partial<CreateVehicleRequest>): Promise<Vehicle> {
    const response = await apiClient.patch<Vehicle>(`/vehicles/${id}`, data);
    return response.data;
  },

  async delete(id: string): Promise<void> {
    await apiClient.delete(`/vehicles/${id}`);
  },

  async getBrands(): Promise<Brand[]> {
    const response = await apiClient.get<Brand[]>('/vehicles/brands');
    return response.data;
  },

  async getModels(brandId: string): Promise<VehicleModel[]> {
    const response = await apiClient.get<VehicleModel[]>(`/vehicles/brands/${brandId}/models`);
    return response.data;
  },
};

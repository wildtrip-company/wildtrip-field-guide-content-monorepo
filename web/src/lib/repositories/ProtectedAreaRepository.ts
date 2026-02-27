import type { RichContent } from '@wildtrip/shared'

import { apiClient } from '../api/client'

export type PublicProtectedArea = {
  slug: string
  name: string
  type: string
  region: string | null
  surface: string | null
  mainImageUrl: string | null
  description: string | null
}

export type PublicDetailProtectedArea = {
  name: string
  type: string
  description: string | null
  location: string | null
  region: string | null
  surface: string | null
  area?: number
  creationYear?: number
  adminEntity: string | null
  content: RichContent | null
  richContent: RichContent | null
  visitorInfo: RichContent | null
  visitorInformation: RichContent | null
  howToGet: RichContent | null
  ecosystems: string[] | null
  mainImageUrl: string | null
  images: string[] | null
  publishedAt: Date | null
  seoTitle: string | null
  seoDescription: string | null
  seoKeywords: string | null
}

export interface ProtectedAreaPaginateParams {
  page?: number
  limit?: number
  search?: string
  type?: string
  region?: string
  sortBy?: 'name' | 'publishedAt'
  sortOrder?: 'asc' | 'desc'
}

export interface ProtectedAreaPaginateResult {
  data: PublicProtectedArea[]
  pagination: {
    page: number
    pageSize: number
    total: number
    totalPages: number
  }
}

class ProtectedAreaRepository {
  async findPublished(params: ProtectedAreaPaginateParams): Promise<ProtectedAreaPaginateResult> {
    const { page = 1, limit = 20, ...filters } = params

    try {
      const response = await apiClient.protectedAreas.findAll({
        page,
        limit,
        status: 'published',
        ...filters,
      })

      // Map the API response to match our types
      const mappedData = (response.data || []).map((item: any) => ({
        ...item,
        mainImageUrl: item.mainImage?.url || item.mainImageUrl || null,
        surface: item.area?.toString() || null,
      }))

      return {
        data: mappedData,
        pagination: {
          page: response.pagination?.page || page,
          pageSize: response.pagination?.limit || limit,
          total: response.pagination?.total || 0,
          totalPages: response.pagination?.totalPages || 0,
        },
      }
    } catch (error) {
      console.error('Error fetching published protected areas:', error)
      return { data: [], pagination: { page, pageSize: limit, total: 0, totalPages: 0 } }
    }
  }

  async findBySlug(slug: string): Promise<PublicDetailProtectedArea | null> {
    try {
      const response = await apiClient.protectedAreas.findBySlug(slug)
      if (!response || response.status !== 'published') {
        return null
      }
      // Map mainImage.url to mainImageUrl and extract images array
      return {
        ...response,
        mainImageUrl: response.mainImage?.url || response.mainImageUrl || null,
        images: response.galleryImages?.map((img: any) => img.url) || null,
        surface: response.area?.toString() || null,
        area: response.area || undefined,
        creationYear: response.creationYear || undefined,
        content: response.richContent || null,
        richContent: response.richContent || null,
        visitorInfo: response.visitorInformation || null,
        visitorInformation: response.visitorInformation || null,
        ecosystems: response.ecosystems || null,
        howToGet: null, // This field doesn't exist in the API response
      }
    } catch (error) {
      console.error('Error fetching protected area by slug:', error)
      return null
    }
  }

  async findById(id: number): Promise<any> {
    try {
      const response = await apiClient.protectedAreas.findById(id)
      if (!response) {
        return null
      }
      // Map mainImage.url to mainImageUrl and include draft data
      return {
        ...response,
        mainImageUrl: response.mainImage?.url || response.mainImageUrl || null,
        images: response.galleryImages?.map((img: any) => img.url) || null,
        surface: response.area?.toString() || null,
        area: response.area || undefined,
        creationYear: response.creationYear || undefined,
        content: response.richContent || null,
        richContent: response.richContent || null,
        visitorInfo: response.visitorInformation || null,
        visitorInformation: response.visitorInformation || null,
        ecosystems: response.ecosystems || null,
        howToGet: null,
      }
    } catch (error) {
      console.error('Error fetching protected area by id:', error)
      return null
    }
  }

  async getLastPublished(limit: number = 3): Promise<PublicProtectedArea[]> {
    try {
      const response = await apiClient.protectedAreas.findAll({
        page: 1,
        limit,
        status: 'published',
        sortBy: 'publishedAt',
        sortOrder: 'desc',
      })
      // Map the API response to match our types
      return (response.data || []).map((item: any) => ({
        ...item,
        mainImageUrl: item.mainImage?.url || item.mainImageUrl || null,
        surface: item.area?.toString() || null,
      }))
    } catch (error) {
      console.error('Error fetching last published protected areas:', error)
      return []
    }
  }

  async getTotalPublished(): Promise<number> {
    try {
      const response = await apiClient.protectedAreas.findAll({
        page: 1,
        limit: 1,
        status: 'published',
      })
      return response.pagination?.total || 0
    } catch (error) {
      console.error('Error fetching total published protected areas:', error)
      return 0
    }
  }
}

export const protectedAreasRepository = new ProtectedAreaRepository()

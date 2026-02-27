import type { RichContent } from '@wildtrip/shared'

import { apiClient } from '../api/client'

export type PublicNews = {
  slug: string
  mainImageUrl: string | null
  title: string
  publishedAt: Date
  category: string
  author: string
  summary: string
}

export type PublicDetailNews = {
  title: string
  author: string | null
  category: string
  summary: string | null
  content: RichContent | null
  mainImageUrl: string | null
  tags: string[] | null
  publishedAt: Date | null
}

export interface NewsPaginateParams {
  page?: number
  limit?: number
  search?: string
  category?: 'conservation' | 'research' | 'education' | 'current_events' | 'all'
  sortBy?: 'publishedAt' | 'title'
  sortOrder?: 'asc' | 'desc'
}

export interface NewsPaginateResult {
  data: PublicNews[]
  pagination: {
    page: number
    pageSize: number
    total: number
    totalPages: number
  }
}

class NewsRepository {
  async findPublished(params: NewsPaginateParams): Promise<NewsPaginateResult> {
    const { page = 1, limit = 10, category, ...filters } = params

    try {
      const response = await apiClient.news.findAll({
        page,
        limit,
        status: 'published',
        ...(category && category !== 'all' ? { category } : {}),
        ...filters,
      })

      // Map the API response to match our types
      const mappedData = (response.data || []).map((item: any) => ({
        ...item,
        mainImageUrl: item.mainImage?.url || item.mainImageUrl || null,
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
      console.error('Error fetching published news:', error)
      return { data: [], pagination: { page, pageSize: limit, total: 0, totalPages: 0 } }
    }
  }

  async findBySlug(slug: string): Promise<PublicDetailNews | null> {
    try {
      const response = await apiClient.news.findBySlug(slug)
      if (!response || response.status !== 'published') {
        return null
      }
      // Map mainImage.url to mainImageUrl
      return {
        ...response,
        mainImageUrl: response.mainImage?.url || response.mainImageUrl || null,
      }
    } catch (error) {
      console.error('Error fetching news by slug:', error)
      return null
    }
  }

  async findById(id: number): Promise<any> {
    try {
      const response = await apiClient.news.findById(id)
      if (!response) {
        return null
      }
      // Map mainImage.url to mainImageUrl and include draft data
      return {
        ...response,
        mainImageUrl: response.mainImage?.url || response.mainImageUrl || null,
      }
    } catch (error) {
      console.error('Error fetching news by id:', error)
      return null
    }
  }

  async getLastPublished(limit: number = 3): Promise<PublicNews[]> {
    try {
      const response = await apiClient.news.findAll({
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
      }))
    } catch (error) {
      console.error('Error fetching last published news:', error)
      return []
    }
  }

  async getTotalPublished(): Promise<number> {
    try {
      const response = await apiClient.news.findAll({
        page: 1,
        limit: 1,
        status: 'published',
      })
      return response.pagination?.total || 0
    } catch (error) {
      console.error('Error fetching total published news:', error)
      return 0
    }
  }
}

export const newsRepository = new NewsRepository()

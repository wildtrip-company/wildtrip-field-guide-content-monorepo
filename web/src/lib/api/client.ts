// API client for public endpoints
const API_URL = import.meta.env.PUBLIC_API_URL || 'http://localhost:3000'

interface FetchOptions extends RequestInit {
  params?: Record<string, string | number | boolean>
}

class APIClient {
  private baseURL: string

  constructor(baseURL: string) {
    this.baseURL = baseURL
  }

  private async request<T>(endpoint: string, options: FetchOptions = {}): Promise<T> {
    const { params, ...fetchOptions } = options

    let url = `${this.baseURL}${endpoint}`

    if (params) {
      const searchParams = new URLSearchParams()
      Object.entries(params).forEach(([key, value]) => {
        searchParams.append(key, String(value))
      })
      url += `?${searchParams.toString()}`
    }

    // Include credentials for preview endpoints that require authentication
    const includeCredentials = endpoint.includes('/preview/')

    const response = await fetch(url, {
      ...fetchOptions,
      headers: {
        'Content-Type': 'application/json',
        ...fetchOptions.headers,
      },
      ...(includeCredentials && { credentials: 'include' }),
    })

    if (!response.ok) {
      const errorBody = await response.text().catch(() => '')
      console.error(
        `API Error: ${response.status} ${response.statusText} - ${url}`,
        errorBody ? `Body: ${errorBody.slice(0, 200)}` : '',
      )
      throw new Error(`API Error: ${response.status} ${response.statusText} - ${url}`)
    }

    return response.json()
  }

  // Species endpoints - Public API
  species = {
    findAll: (params?: any) => this.request<any>('/api/public/species', { params }),
    findBySlug: (slug: string) => this.request<any>(`/api/public/species/slug/${slug}`),
    findById: (id: number) => this.request<any>(`/api/public/species/${id}`),
  }

  // Protected Areas endpoints - Public API
  protectedAreas = {
    findAll: (params?: any) => this.request<any>('/api/public/protected-areas', { params }),
    findBySlug: (slug: string) => this.request<any>(`/api/public/protected-areas/slug/${slug}`),
    findById: (id: number) => this.request<any>(`/api/public/protected-areas/${id}`),
  }

  // News endpoints - Public API
  news = {
    findAll: (params?: any) => this.request<any>('/api/public/news', { params }),
    findBySlug: (slug: string) => this.request<any>(`/api/public/news/slug/${slug}`),
    findById: (id: number) => this.request<any>(`/api/public/news/${id}`),
  }

  // Preview endpoints - Requires authentication
  preview = {
    species: (id: number) => this.request<any>(`/api/preview/species/${id}`),
    protectedAreas: (id: number) => this.request<any>(`/api/preview/protected-areas/${id}`),
    news: (id: number) => this.request<any>(`/api/preview/news/${id}`),
  }
}

export const apiClient = new APIClient(API_URL)

import api from './axios'

export interface RegisterPayload {
  name: string
  email: string
  password: string
}

export interface LoginPayload {
  email: string
  password: string
}

export interface AuthUser {
  id: string
  name: string
  email: string
  role: string
}

export interface AuthResponse {
  user: AuthUser
  token: string
}

export const authApi = {
  register: (data: RegisterPayload) =>
    api.post<AuthResponse>('/auth/register', data),

  login: (data: LoginPayload) =>
    api.post<AuthResponse>('/auth/login', data),

  me: () =>
    api.get<AuthUser>('/auth/me'),
}

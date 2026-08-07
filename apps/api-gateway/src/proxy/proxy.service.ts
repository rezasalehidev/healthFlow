import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { AxiosError, type AxiosRequestConfig, type Method } from 'axios';
import { firstValueFrom } from 'rxjs';
import {
  AppException,
  CORRELATION_ID_HEADER,
  ErrorCode,
  REQUEST_ID_HEADER,
} from '@healthflow/common';

export interface ProxyRequestOptions {
  service: 'auth' | 'patient' | 'doctor' | 'appointment';
  method: Method;
  path: string;
  body?: unknown;
  headers?: Record<string, string | undefined>;
  correlationId?: string;
  requestId?: string;
  authorization?: string;
  ip?: string;
  userAgent?: string;
}

export interface ProxyResult {
  status: number;
  data: unknown;
}

/**
 * Thin HTTP proxy to internal services.
 * Propagates correlation/request IDs and maps transport failures to AppException.
 */
@Injectable()
export class ProxyService {
  private readonly logger = new Logger(ProxyService.name);
  private readonly timeoutMs: number;

  constructor(
    private readonly http: HttpService,
    private readonly config: ConfigService,
  ) {
    this.timeoutMs = Number(this.config.get('PROXY_TIMEOUT_MS', 10_000));
  }

  async forward(options: ProxyRequestOptions): Promise<ProxyResult> {
    const baseUrl = this.resolveBaseUrl(options.service);
    const url = `${baseUrl.replace(/\/$/, '')}${options.path.startsWith('/') ? '' : '/'}${options.path}`;

    const headers: Record<string, string> = {
      'content-type': 'application/json',
      accept: 'application/json',
    };

    if (options.correlationId) {
      headers[CORRELATION_ID_HEADER] = options.correlationId;
    }
    if (options.requestId) {
      headers[REQUEST_ID_HEADER] = options.requestId;
    }
    if (options.authorization) {
      headers.authorization = options.authorization;
    }
    if (options.userAgent) {
      headers['user-agent'] = options.userAgent;
    }
    if (options.ip) {
      headers['x-forwarded-for'] = options.ip;
    }

    for (const [key, value] of Object.entries(options.headers ?? {})) {
      if (value) {
        headers[key] = value;
      }
    }

    const axiosConfig: AxiosRequestConfig = {
      url,
      method: options.method,
      data: options.body,
      headers,
      timeout: this.timeoutMs,
      validateStatus: () => true,
    };

    try {
      const response = await firstValueFrom(this.http.request(axiosConfig));
      return { status: response.status, data: response.data };
    } catch (error: unknown) {
      this.logger.error({
        message: 'Upstream request failed',
        service: options.service,
        path: options.path,
        error: error instanceof Error ? error.message : error,
      });

      if (error instanceof AxiosError && error.code === 'ECONNABORTED') {
        throw new AppException(ErrorCode.INTERNAL_ERROR, 'Upstream service timed out', 504);
      }

      throw new AppException(ErrorCode.INTERNAL_ERROR, 'Upstream service unavailable', 503);
    }
  }

  private resolveBaseUrl(service: ProxyRequestOptions['service']): string {
    const map: Record<ProxyRequestOptions['service'], string> = {
      auth: this.config.getOrThrow<string>('AUTH_SERVICE_URL'),
      patient: this.config.get('PATIENT_SERVICE_URL', 'http://localhost:3002'),
      doctor: this.config.get('DOCTOR_SERVICE_URL', 'http://localhost:3003'),
      appointment: this.config.get('APPOINTMENT_SERVICE_URL', 'http://localhost:3004'),
    };
    return map[service];
  }
}

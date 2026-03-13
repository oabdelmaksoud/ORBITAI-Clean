import { describe, it, expect, vi } from 'vitest';
import { Request, Response } from 'express';
import { errorHandler, AppError } from '../../middleware/errorHandler.js';
import { logger } from '../../utils/logger.js';

// Mock logger
vi.mock('../../utils/logger.js', () => ({
  logger: {
    error: vi.fn()
  }
}));

describe('Error Handler Middleware', () => {
  let req: Partial<Request>;
  let res: Partial<Response>;
  let jsonMock: ReturnType<typeof vi.fn>;
  let statusMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    jsonMock = vi.fn().mockReturnThis();
    statusMock = vi.fn().mockReturnValue({ json: jsonMock });
    
    req = {
      path: '/api/test',
      method: 'GET'
    };

    res = {
      status: statusMock,
      json: jsonMock
    };

    vi.clearAllMocks();
  });

  it('should handle AppError with status code', () => {
    const error = new AppError('Test error', 400);

    errorHandler(error, req as Request, res as Response, () => {});

    expect(statusMock).toHaveBeenCalledWith(400);
    expect(jsonMock).toHaveBeenCalledWith({
      success: false,
      error: {
        message: 'Test error'
      }
    });
    expect(logger.error).toHaveBeenCalled();
  });

  it('should handle generic Error with 500 status', () => {
    const error = new Error('Generic error');

    errorHandler(error, req as Request, res as Response, () => {});

    expect(statusMock).toHaveBeenCalledWith(500);
    expect(jsonMock).toHaveBeenCalledWith({
      success: false,
      error: {
        message: 'Generic error'
      }
    });
  });

  it('should include stack trace in development mode', () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';

    const error = new AppError('Test error', 400);

    errorHandler(error, req as Request, res as Response, () => {});

    expect(jsonMock).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.objectContaining({
          stack: expect.any(String)
        })
      })
    );

    process.env.NODE_ENV = originalEnv;
  });

  it('should not include stack trace in production mode', () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';

    const error = new AppError('Test error', 400);

    errorHandler(error, req as Request, res as Response, () => {});

    expect(jsonMock).toHaveBeenCalledWith({
      success: false,
      error: {
        message: 'Test error'
      }
    });

    process.env.NODE_ENV = originalEnv;
  });
});


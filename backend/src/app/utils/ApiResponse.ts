class ApiResponse {
    statusCode: number;
    message: string;
    success: boolean;
    data?: unknown;

    constructor(statusCode: number, message: string, data?: unknown) {
        this.statusCode = statusCode;
        this.message = message;
        this.success = statusCode < 400;
        this.data = data;
    }
}

export { ApiResponse }

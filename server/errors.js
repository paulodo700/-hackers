// Erro de negócio com código HTTP. As rotas convertem em { error: mensagem }.
class AppError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

module.exports = { AppError };

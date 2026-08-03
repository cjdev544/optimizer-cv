export class JobOffer {
  private constructor(private readonly description: string) {}

  static create(description: string): JobOffer {
    const trimmed = description.trim();
    if (trimmed.length < 30) {
      throw new Error('La descripción de la oferta de empleo es demasiado corta.');
    }
    return new JobOffer(trimmed);
  }

  getDescription(): string {
    return this.description;
  }
}

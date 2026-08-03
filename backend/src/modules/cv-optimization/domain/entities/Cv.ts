export class Cv {
  private constructor(private readonly rawText: string) {}

  static create(rawText: string): Cv {
    const trimmed = rawText.trim();
    if (trimmed.length < 50) {
      throw new Error('El texto del CV es demasiado corto para ser optimizado.');
    }
    return new Cv(trimmed);
  }

  getText(): string {
    return this.rawText;
  }
}

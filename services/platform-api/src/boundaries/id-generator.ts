export interface IdGenerator {
  nextId(): string
}

export const ID_GENERATOR = Symbol('ID_GENERATOR')
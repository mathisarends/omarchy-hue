export interface Problem {
  line: number
  message: string
}

export function findBracelessBodies(source: string): Problem[]

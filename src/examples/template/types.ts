export type Item = {
  id: number
  name: string
  qty: number
  done: boolean
}

export type Filter = 'all' | 'todo' | 'done'

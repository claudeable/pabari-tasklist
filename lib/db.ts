import fs from 'fs'
import path from 'path'
import { randomUUID } from 'crypto'
import { Task, TaskUpdate } from '@/types'

const DATA_DIR = process.env.DATA_DIR ?? path.join(process.cwd(), 'data')
const DATA_FILE = path.join(DATA_DIR, 'tasks.json')

function normalize(t: Record<string, unknown>): Task {
  return {
    ...(t as unknown as Task),
    id:           String(t.id),
    task_updates: Array.isArray(t.task_updates) ? t.task_updates as TaskUpdate[] : [],
    updates:      typeof t.updates === 'string' ? t.updates : '',
    hk_comment:   typeof t.hk_comment === 'string' ? t.hk_comment : '',
    status_wk:    typeof t.status_wk === 'string' ? t.status_wk : '',
    date:         typeof t.date === 'string' ? t.date : '',
    category:     typeof t.category === 'string' ? t.category : '',
    responsible:  typeof t.responsible === 'string' ? t.responsible : '',
    section:      typeof t.section === 'string' ? t.section : '',
  }
}

function read(): Task[] {
  const raw = fs.readFileSync(DATA_FILE, 'utf-8')
  const parsed = JSON.parse(raw) as Record<string, unknown>[]
  return parsed.map(normalize)
}

function write(tasks: Task[]): void {
  fs.writeFileSync(DATA_FILE, JSON.stringify(tasks, null, 2), 'utf-8')
}

export function getTasks(): Task[] {
  return read()
}

export function getTaskById(id: string): Task | undefined {
  return read().find(t => t.id === String(id))
}

export function createTask(
  data: Omit<Task, 'id' | 'created_at' | 'updated_at' | 'task_updates'>
): Task {
  const tasks = read()
  const now = new Date().toISOString()
  const task: Task = {
    ...data,
    id:           randomUUID(),
    task_updates: [],
    created_at:   now,
    updated_at:   now,
  }
  tasks.push(task)
  write(tasks)
  return task
}

export function updateTask(id: string, updates: Partial<Task>): Task | null {
  const tasks = read()
  const idx = tasks.findIndex(t => String(t.id) === String(id))
  if (idx === -1) return null
  tasks[idx] = { ...tasks[idx], ...updates, updated_at: new Date().toISOString() }
  write(tasks)
  return tasks[idx]
}

export function deleteTask(id: string): boolean {
  const tasks = read()
  const idx = tasks.findIndex(t => String(t.id) === String(id))
  if (idx === -1) return false
  tasks.splice(idx, 1)
  write(tasks)
  return true
}

export function addUpdate(
  taskId: string,
  data: { date: string; text: string }
): TaskUpdate | null {
  const tasks = read()
  const idx = tasks.findIndex(t => String(t.id) === String(taskId))
  if (idx === -1) return null
  const update: TaskUpdate = {
    id:         randomUUID(),
    task_id:    String(taskId),
    date:       data.date,
    text:       data.text,
    created_at: new Date().toISOString(),
  }
  if (!Array.isArray(tasks[idx].task_updates)) tasks[idx].task_updates = []
  ;(tasks[idx].task_updates as TaskUpdate[]).unshift(update)
  tasks[idx].updated_at = new Date().toISOString()
  write(tasks)
  return update
}

import type { ReferralRow } from '@/lib/types'

const HEADERS = ['Purchase ID', 'Student', 'Plan', 'Employee', 'Coupon', 'Incentive Amount', 'Payout Status']

export function buildPayoutCsv(rows: ReferralRow[]): string {
  const lines = [HEADERS.map(csvCell).join(',')]
  for (const row of rows) {
    lines.push(
      [row.purchaseId, row.studentName, row.planName, row.employeeName || '', row.couponCode || '', row.incentiveAmount, row.isPaid ? 'Paid' : '']
        .map(csvCell)
        .join(','),
    )
  }
  return lines.join('\r\n')
}

export function downloadCsv(content: string, filename: string): void {
  const blob = new Blob(['﻿', content], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

// Reads a re-uploaded CSV (same shape as buildPayoutCsv, edited offline) and
// returns the purchase IDs whose "Payout Status" column was set to "Paid".
export function extractPaidPurchaseIds(csvText: string): number[] {
  const lines = csvText.split(/\r?\n/).filter(Boolean)
  if (lines.length < 2) return []
  const header = parseCsvLine(lines[0]).map((cell) => cell.trim().toLowerCase())
  const idIndex = header.indexOf('purchase id')
  const statusIndex = header.indexOf('payout status')
  if (idIndex === -1 || statusIndex === -1) return []

  const ids: number[] = []
  for (const line of lines.slice(1)) {
    const cells = parseCsvLine(line)
    const status = String(cells[statusIndex] || '').trim().toLowerCase()
    const id = Number(cells[idIndex])
    if (status === 'paid' && id) ids.push(id)
  }
  return ids
}

function csvCell(value: unknown): string {
  const text = String(value ?? '')
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

function parseCsvLine(line: string): string[] {
  const cells: string[] = []
  let current = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i]
    if (inQuotes) {
      if (char === '"' && line[i + 1] === '"') {
        current += '"'
        i += 1
      } else if (char === '"') {
        inQuotes = false
      } else {
        current += char
      }
    } else if (char === '"') {
      inQuotes = true
    } else if (char === ',') {
      cells.push(current)
      current = ''
    } else {
      current += char
    }
  }
  cells.push(current)
  return cells
}

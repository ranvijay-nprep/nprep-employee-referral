import { STUDENT_DISCOUNT_PERCENT } from '@/lib/incentives'

// The copy employees send to students. Admins edit these from the admin
// panel's "Message management" card (stored in the `message_templates` table);
// the definitions below are the built-in defaults, used to seed that table on
// first run and as the fallback if a row is ever missing.
//
// Deliberately shared by client and server: the employee's browser renders a
// template into a wa.me link, and the admin preview renders the same string,
// so substitution must live in one place with no Node-only imports.

// Where students are sent to buy. Overridable per-environment; the default is
// NPrep's public site.
export const STUDENT_APP_URL = process.env.NEXT_PUBLIC_STUDENT_APP_URL || 'https://nprep.in'

export interface TemplateVariable {
  token: string
  label: string
  sample: string
}

export const TEMPLATE_VARIABLES: TemplateVariable[] = [
  { token: 'name', label: "Student's name", sample: 'Riya' },
  { token: 'code', label: 'Referral coupon code', sample: 'NPrep1023' },
  { token: 'discount', label: 'Student discount %', sample: String(STUDENT_DISCOUNT_PERCENT) },
  { token: 'referrer', label: "Employee's first name", sample: 'Aman' },
  { token: 'link', label: 'NPrep link', sample: STUDENT_APP_URL },
]

export interface MessageTemplateDef {
  key: string
  title: string
  description: string
  body: string
}

export const MESSAGE_TEMPLATES: MessageTemplateDef[] = [
  {
    key: 'whatsapp_share',
    title: 'WhatsApp — first share',
    description: 'Prefilled when an employee sends their coupon to someone on WhatsApp.',
    body:
      'Hi {{name}}! 👋\n\n' +
      'Here is a special coupon for you to get {{discount}}% scholarship on any NPrep plan.\n\n' +
      'Coupon code: *{{code}}*\n\n' +
      'Just apply it at checkout here: {{link}}\n\n' +
      '— {{referrer}}, NPrep',
  },
  {
    key: 'whatsapp_reminder',
    title: 'WhatsApp — reminder',
    description: "Prefilled when an employee nudges someone who hasn't purchased yet.",
    body:
      'Hi {{name}}, just checking in! 😊\n\n' +
      'Your {{discount}}% scholarship coupon *{{code}}* is still active. ' +
      'Apply it at checkout here: {{link}}\n\n' +
      'Happy to help if you have any questions about the plans.\n\n' +
      '— {{referrer}}, NPrep',
  },
  {
    key: 'copy_share',
    title: 'Copy / paste share message',
    description: 'Used by the "Copy share message" button, for sharing outside WhatsApp.',
    body:
      'Use my NPrep referral code {{code}} to get {{discount}}% scholarship on any NPrep plan. ' +
      'Apply it at checkout: {{link}}',
  },
  {
    key: 'employee_notice',
    title: 'Notice on the referrer dashboard',
    description: 'Shown as a banner to every employee. Leave blank to hide the banner entirely.',
    body: '',
  },
]

export type TemplateVars = Partial<Record<'name' | 'code' | 'discount' | 'referrer' | 'link', string>>

// Replaces {{token}} with its value. An unknown or unsupplied token is left
// visible rather than silently blanked - an employee spotting "{{name}}" in a
// draft is far better than a student receiving "Hi ,".
export function renderTemplate(body: string, vars: TemplateVars): string {
  return body.replace(/\{\{\s*(\w+)\s*\}\}/g, (match, token: string) => {
    const value = vars[token as keyof TemplateVars]
    return value === undefined || value === '' ? match : value
  })
}

export function getDefaultTemplateBody(key: string): string {
  return MESSAGE_TEMPLATES.find((template) => template.key === key)?.body ?? ''
}

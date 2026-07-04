import type { LibraryGameCompanyRole, LibraryGamePersonRole } from '@kisaki3/extension-api'
import type { VniteExtraField, VniteGameMetadata } from '../vnite/models'
import { isVniteEngineExtraKey, normalizeExtraKey } from './tags'

export interface VniteMappedCompany {
  name: string
  role: LibraryGameCompanyRole
}

export interface VniteMappedPerson {
  name: string
  role: LibraryGamePersonRole
  sourceKey: string
}

export interface VnitePersonExtraMappingResult {
  people: readonly VniteMappedPerson[]
  unknownExtras: readonly VniteExtraField[]
}

const EXTRA_PERSON_ROLE_BY_KEY = new Map<string, LibraryGamePersonRole>([
  ['director', 'director'],
  ['scenario', 'scenario'],
  ['scenario writer', 'scenario'],
  ['illustration', 'illustration'],
  ['illustrator', 'illustration'],
  ['music', 'music'],
  ['voice', 'actor']
])

const EXTRA_PERSON_ROLE_BY_RAW_KEY = new Map<string, LibraryGamePersonRole>([
  ['原画', 'illustration']
])

export const VNITE_PERSON_EXTRA_KEYS = new Set(EXTRA_PERSON_ROLE_BY_KEY.keys())

export function mapVniteCompanies(metadata: VniteGameMetadata): readonly VniteMappedCompany[] {
  const companies: VniteMappedCompany[] = []
  pushCompanies(companies, metadata.developers, 'developer')
  pushCompanies(companies, metadata.publishers, 'publisher')
  return dedupeCompanies(companies)
}

export function mapVnitePersonsFromExtra(
  extra: readonly VniteExtraField[]
): VnitePersonExtraMappingResult {
  const people: VniteMappedPerson[] = []
  const unknownExtras: VniteExtraField[] = []

  for (const field of extra) {
    const role = getPersonRoleForExtraKey(field.key)
    if (!role) {
      if (!isVniteEngineExtraKey(field.key)) {
        unknownExtras.push(field)
      }
      continue
    }

    for (const value of field.value) {
      const name = value.trim()
      if (name) {
        people.push({ name, role, sourceKey: field.key })
      }
    }
  }

  return {
    people: dedupePeople(people),
    unknownExtras
  }
}

export function getPersonRoleForExtraKey(key: string): LibraryGamePersonRole | undefined {
  return (
    EXTRA_PERSON_ROLE_BY_RAW_KEY.get(key.trim()) ??
    EXTRA_PERSON_ROLE_BY_KEY.get(normalizeExtraKey(key))
  )
}

function pushCompanies(
  companies: VniteMappedCompany[],
  names: readonly string[],
  role: LibraryGameCompanyRole
): void {
  for (const value of names) {
    const name = value.trim()
    if (name) {
      companies.push({ name, role })
    }
  }
}

function dedupeCompanies(companies: readonly VniteMappedCompany[]): readonly VniteMappedCompany[] {
  const seen = new Set<string>()
  const result: VniteMappedCompany[] = []

  for (const company of companies) {
    const key = `${company.role}\u0000${company.name}`
    if (seen.has(key)) {
      continue
    }
    seen.add(key)
    result.push(company)
  }

  return result
}

function dedupePeople(people: readonly VniteMappedPerson[]): readonly VniteMappedPerson[] {
  const seen = new Set<string>()
  const result: VniteMappedPerson[] = []

  for (const person of people) {
    const key = `${person.role}\u0000${person.name}`
    if (seen.has(key)) {
      continue
    }
    seen.add(key)
    result.push(person)
  }

  return result
}

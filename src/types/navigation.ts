export type SectionId = 'budget' | 'meals' | 'shopping' | 'pantry'
export type PageId = 'overview' | SectionId

export interface WorkspaceSection {
  id: SectionId
  label: string
  description: string
}

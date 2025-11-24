export type DocumentType = 'contract' | 'bidding_doc' | 'our_bid' | 'competitor_bid' | 'evaluation' | 'other'

export interface Document {
  id: string
  title: string
  document_type: DocumentType
  document_subtype?: string
  status: string
  file_name: string
  file_size: number
  created_at: string
  updated_at: string
}

/**
 * Initial grouping of the household's history into NEEDS (prototype, curated once by Claude from
 * the real order history + Krill categories on 2026-11-17).
 *
 * Why curated: Krill's leaf categories are sometimes too broad (e.g. "Legume Fresco" mixes onion and
 * carrot; "Manteiga" mixes salted and unsalted), and some brands matter while others don't.
 * For other households the app falls back to auto-grouping (same Krill section + same product type
 * word + size); the user can then merge/split in the list editor.
 * Products from history that aren't in any group become their own exact-product need.
 */
import type { RoomId } from '../domain/types'

export interface GroupDef {
  key: string
  name: string
  members: number[] // Krill product ids seen in history
  sectionId?: number
  keywords?: string[]
  match?: 'cheapest' | 'exact'
  room?: RoomId
}

export const GROUPS: GroupDef[] = [
  // Fridge & freezer
  { key: 'mussarela', name: 'Queijo mussarela fatiado', members: [6706], sectionId: 187, keywords: ['fatiad'] },
  { key: 'requeijao', name: 'Requeijão cremoso 200g', members: [6908], sectionId: 192 },
  { key: 'queijo-ralado', name: 'Queijo ralado', members: [86], sectionId: 190 },
  { key: 'mortadela', name: 'Mortadela defumada 200g', members: [6216, 6662], sectionId: 181 },
  { key: 'manteiga-sal', name: 'Manteiga com sal 200g', members: [16530, 2474], sectionId: 178, keywords: ['com sal'] },
  { key: 'manteiga-sem-sal', name: 'Manteiga sem sal 200g', members: [3680, 10147], sectionId: 178, keywords: ['sem sal'] },
  { key: 'iogurte', name: 'Iogurte natural 450g', members: [6142, 6922], sectionId: 242, keywords: ['450g'] },
  { key: 'pao-de-queijo', name: 'Pão de queijo congelado', members: [4992, 1030], sectionId: 140 },
  { key: 'acem', name: 'Acém bovino', members: [9888, 4270], sectionId: 118, keywords: ['acem'] },
  { key: 'frango', name: 'Coxa e sobrecoxa de frango', members: [167], sectionId: 114 },
  { key: 'frango-desossado', name: 'Coxa e sobrecoxa desossada', members: [6616], sectionId: 115 },
  { key: 'toscana', name: 'Linguiça toscana', members: [9264], sectionId: 126, keywords: ['toscana'] },
  { key: 'calabresa', name: 'Linguiça calabresa', members: [2704], sectionId: 126, keywords: ['calabresa'] },
  { key: 'tilapia', name: 'Filé de tilápia congelado', members: [3337], sectionId: 127, keywords: ['tilapia'] },
  { key: 'bacon', name: 'Bacon', members: [13073], sectionId: 116 },
  { key: 'salame', name: 'Salame fatiado', members: [5320], sectionId: 193 },
  // Kitchen pantry
  { key: 'leite', name: 'Leite integral 1L', members: [9, 6490], sectionId: 255, keywords: ['1l'] },
  { key: 'cafe', name: 'Café tradicional 500g', members: [5135, 2599], sectionId: 292, keywords: ['500g'] },
  { key: 'oleo', name: 'Óleo de soja 900ml', members: [7851, 9240], sectionId: 335 },
  { key: 'ovos', name: 'Ovos brancos', members: [10993, 1022, 2225], sectionId: 337 },
  { key: 'penne', name: 'Macarrão penne 500g', members: [743], sectionId: 328 },
  { key: 'tapioca', name: 'Tapioca 500g', members: [4725], sectionId: 344, keywords: ['tapioca'] },
  { key: 'farinha', name: 'Farinha de trigo 1kg', members: [9243], sectionId: 316 },
  { key: 'acucar', name: 'Açúcar cristal 1kg', members: [9249], sectionId: 303 },
  { key: 'azeite', name: 'Azeite extra virgem 500ml', members: [9577], sectionId: 314 },
  { key: 'aveia', name: 'Aveia em flocos', members: [13257], sectionId: 313 },
  { key: 'grao-de-bico', name: 'Grão de bico', members: [12699], sectionId: 323, keywords: ['grão'] },
  { key: 'extrato', name: 'Extrato de tomate', members: [11149], sectionId: 356 },
  { key: 'sardinha', name: 'Sardinha em óleo', members: [414], sectionId: 371 },
  { key: 'milho', name: 'Milho verde em lata', members: [12827], sectionId: 360 },
  { key: 'leite-condensado', name: 'Leite condensado 395g', members: [489, 6328], sectionId: 170 },
  { key: 'pao-forma', name: 'Pão de forma tradicional', members: [6334, 10026], sectionId: 383, keywords: ['tradicional'] },
  // Back storage
  { key: 'papel-toalha', name: 'Papel toalha', members: [11055, 6041], sectionId: 40, keywords: ['papel toalha'] },
  { key: 'filtro', name: 'Filtro de café 103', members: [528, 3034], sectionId: 38, keywords: ['103'] },
  { key: 'agua-coco', name: 'Água de coco 1L', members: [9123], sectionId: 59 },
  // Bathroom
  { key: 'papel-higienico', name: 'Papel higiênico folha dupla', members: [16880, 12717], sectionId: 218, keywords: ['folha dupla'] },
  // Laundry & cleaning
  { key: 'detergente', name: 'Detergente 500ml', members: [6468], sectionId: 268 },
  { key: 'esponja', name: 'Esponja multiuso', members: [8590, 8073], sectionId: 269, keywords: ['multiuso'] },
  { key: 'la-de-aco', name: 'Lã de aço', members: [5015], sectionId: 269, keywords: ['lã'] },
  { key: 'saco-lixo', name: 'Saco de lixo 50L', members: [11064], sectionId: 284, keywords: ['50l'] },
  { key: 'sabao-po', name: 'Sabão em pó', members: [6986] },
  // Fresh produce (unbranded already; grouped where Krill sells variants)
  { key: 'tomate', name: 'Tomate', members: [7634, 4074], sectionId: 237, keywords: ['tomate'] },
]

/** Extra known products (not in history) that are valid alternatives – seen in Krill's section listing. */
export const EXTRA_PRODUCTS = [
  { id: 6490, name: 'Leite Uht Piracanjuba Integral Com Tampa 1l', dept: 'Leites', deptId: 15, sectionId: 255, section: 'Leites > Leite Integral', price: 5.99 },
]

/** Generic start for households without history: group keys + 2-month targets for 2 adults. */
export const BASIC_LIST: [string, number][] = [
  ['leite', 12], ['cafe', 4], ['oleo', 4], ['ovos', 3], ['penne', 6], ['farinha', 2], ['acucar', 2], ['extrato', 4],
  ['manteiga-sal', 2], ['mussarela', 3], ['papel-higienico', 3], ['papel-toalha', 3], ['detergente', 4],
  ['esponja', 2], ['saco-lixo', 3], ['sabao-po', 3],
]

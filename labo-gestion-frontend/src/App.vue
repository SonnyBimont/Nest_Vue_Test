<script setup lang="ts">
import axios from 'axios'
import { computed, nextTick, onMounted, onUnmounted, ref } from 'vue'
import Login from './components/Login.vue'
import { apiClient } from './services/api'

interface Supplier {
  id: number
  name: string
  contact: string
  email: string
}

interface Item {
  id?: number
  name: string
  internalRef?: string
  supplierRef: string
  price?: number | null
  quantity: number
  stockMax?: number | null
  isP2: boolean
  lowStockThreshold?: number | null
  supplierId?: number | null
  supplier?: Supplier
}

interface RestockReportItem {
  id: number
  name: string
  internalRef: string | null
  supplierRef: string | null
  supplierName: string | null
  quantity: number
  stockMax: number | null
  quantityToRestock: number
  fillRate: number | null
  isLowStock: boolean
}

type InventorySortKey = 'name' | 'quantity' | 'stockMax' | 'supplier' | 'gap'

const isAuthenticated = ref(false)
const items = ref<Item[]>([])
const suppliers = ref<Supplier[]>([])
const restockReport = ref<RestockReportItem[]>([])
const error = ref<string | null>(null)
const successMessage = ref<string | null>(null)
const editingId = ref<number | null>(null)
const decrementAmounts = ref<Record<number, number>>({})
const inventorySearch = ref('')
const inventoryFilter = ref<'all' | 'low' | 'restock' | 'ok'>('all')
const inventorySortKey = ref<InventorySortKey>('name')
const inventorySortDirection = ref<'asc' | 'desc'>('asc')
const supplierSearch = ref('')
const supplierFormSection = ref<HTMLElement | null>(null)
const itemFormSection = ref<HTMLElement | null>(null)
const highlightedSection = ref<'supplier' | 'item' | null>(null)
const supplierForm = ref({
  name: '',
  contact: '',
  email: '',
})
const editingSupplierId = ref<number | null>(null)
let sectionHighlightTimeout: ReturnType<typeof setTimeout> | null = null

const createEmptyFormItem = (): Item => ({
  name: '',
  internalRef: '',
  supplierRef: '',
  price: null,
  quantity: 0,
  stockMax: null,
  isP2: false,
  lowStockThreshold: 5,
  supplierId: null,
})

const formItem = ref<Item>(createEmptyFormItem())

const getSupplierItemCount = (supplierId: number) =>
  items.value.filter((item) => item.supplierId === supplierId).length

const isSupplierUsed = (supplierId: number) => getSupplierItemCount(supplierId) > 0

const suppliersByRecency = computed(() =>
  [...suppliers.value].sort((leftSupplier, rightSupplier) => rightSupplier.id - leftSupplier.id),
)

const filteredSuppliers = computed(() => {
  const searchTerm = supplierSearch.value.trim().toLocaleLowerCase('fr-FR')

  if (searchTerm.length === 0) {
    return suppliersByRecency.value.slice(0, 3)
  }

  return suppliersByRecency.value.filter((supplier) =>
    [supplier.name, supplier.contact, supplier.email]
      .some((value) => value.toLocaleLowerCase('fr-FR').includes(searchTerm)),
  )
})

const itemsToRestock = computed(() =>
  restockReport.value.filter((item) => item.quantityToRestock > 0),
)

const getItemThreshold = (item: Item) => item.lowStockThreshold ?? 5

const isLowStockItem = (item: Item) => item.quantity <= getItemThreshold(item)

const lowStockItems = computed(() => items.value.filter((item) => isLowStockItem(item)))

const filteredInventoryItems = computed(() => {
  const searchTerm = inventorySearch.value.trim().toLocaleLowerCase('fr-FR')

  const filteredItems = items.value.filter((item) => {
    const matchesSearch =
      searchTerm.length === 0 ||
      [
        item.name,
        item.internalRef,
        item.supplierRef,
        item.supplier?.name,
      ]
        .filter((value): value is string => Boolean(value))
        .some((value) => value.toLocaleLowerCase('fr-FR').includes(searchTerm))

    if (!matchesSearch) {
      return false
    }

    if (inventoryFilter.value === 'low') {
      return isLowStockItem(item)
    }

    if (inventoryFilter.value === 'restock') {
      return getRestockGap(item) !== null && getRestockGap(item)! > 0
    }

    if (inventoryFilter.value === 'ok') {
      return !isLowStockItem(item)
    }

    return true
  })

  return [...filteredItems].sort((leftItem, rightItem) => {
    const leftGap = getRestockGap(leftItem) ?? -1
    const rightGap = getRestockGap(rightItem) ?? -1
    let comparison = 0

    switch (inventorySortKey.value) {
      case 'quantity':
        comparison = leftItem.quantity - rightItem.quantity
        break
      case 'stockMax':
        comparison = (leftItem.stockMax ?? -1) - (rightItem.stockMax ?? -1)
        break
      case 'supplier':
        comparison = (leftItem.supplier?.name ?? '').localeCompare(rightItem.supplier?.name ?? '', 'fr')
        break
      case 'gap':
        comparison = leftGap - rightGap
        break
      case 'name':
      default:
        comparison = leftItem.name.localeCompare(rightItem.name, 'fr')
        break
    }

    return inventorySortDirection.value === 'asc' ? comparison : -comparison
  })
})

const getErrorMessage = (err: unknown, fallback: string) => {
  if (axios.isAxiosError(err)) {
    const message = err.response?.data?.message

    if (Array.isArray(message)) {
      return message.join(', ')
    }

    if (typeof message === 'string' && message.length > 0) {
      return message
    }

    if (err.response?.status === 401) {
      logout()
      return 'Session expirée. Veuillez vous reconnecter.'
    }
  }

  return fallback
}

const toNullableNumber = (value: number | string | null | undefined) => {
  if (value === '' || value === null || value === undefined) {
    return null
  }

  const parsedValue = Number(value)
  return Number.isNaN(parsedValue) ? null : parsedValue
}

const buildItemPayload = () => {
  const payload: Record<string, string | number | boolean> = {
    name: formItem.value.name.trim(),
    supplierRef: formItem.value.supplierRef.trim(),
    quantity: Number(formItem.value.quantity),
    isP2: Boolean(formItem.value.isP2),
  }

  const internalRef = formItem.value.internalRef?.trim()
  const price = toNullableNumber(formItem.value.price)
  const stockMax = toNullableNumber(formItem.value.stockMax)
  const lowStockThreshold = toNullableNumber(formItem.value.lowStockThreshold)
  const supplierId = toNullableNumber(formItem.value.supplierId)

  if (internalRef) payload.internalRef = internalRef
  if (price !== null) payload.price = price
  if (stockMax !== null) payload.stockMax = stockMax
  if (lowStockThreshold !== null) payload.lowStockThreshold = lowStockThreshold
  if (supplierId !== null) payload.supplierId = supplierId

  return payload
}

const getRestockGap = (item: Item) => {
  if (item.stockMax === null || item.stockMax === undefined) {
    return null
  }

  return Math.max(item.stockMax - item.quantity, 0)
}

const getReportItemThreshold = (reportItem: RestockReportItem) => {
  const sourceItem = items.value.find((item) => item.id === reportItem.id)
  return sourceItem ? getItemThreshold(sourceItem) : 5
}

const getReportItemTotalPrice = (reportItem: RestockReportItem) => {
  const sourceItem = items.value.find((item) => item.id === reportItem.id)
  const unitPrice = sourceItem?.price

  if (unitPrice === null || unitPrice === undefined) {
    return null
  }

  return unitPrice * reportItem.quantityToRestock
}

const formatCurrency = (value?: number | null) => {
  if (value === null || value === undefined) {
    return '-'
  }

  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
  }).format(value)
}

const getSupplierById = (supplierId?: number | null) => {
  if (!supplierId) {
    return null
  }

  return suppliers.value.find((supplier) => supplier.id === supplierId) ?? null
}

const getSupplierForReportItem = (reportItem: RestockReportItem) => {
  const item = items.value.find((inventoryItem) => inventoryItem.id === reportItem.id)
  return getSupplierById(item?.supplierId)
}

const buildRestockMailto = (
  supplier: Supplier,
  restockItems: Array<{ name: string; supplierRef: string | null; quantityToRestock: number }>,
  scopeLabel: string,
) => {
  const subject = `Demande de réapprovisionnement labo - ${supplier.name}`
  const bodyLines = [
    `Bonjour ${supplier.contact},`,
    '',
    `${scopeLabel} :`,
    '',
  ]

  if (restockItems.length > 0) {
    restockItems.forEach((item) => {
      bodyLines.push(
        `- Article : ${item.name}`,
        `  Référence fournisseur : ${item.supplierRef || 'Non renseignée'}`,
        `  Quantité à réapprovisionner : ${item.quantityToRestock}`,
        '',
      )
    })
  } else {
    bodyLines.push(
      `- Aucun article n'est actuellement en dessous du stock cible pour ${supplier.name}.`,
      '',
    )
  }

  bodyLines.push('Merci,', 'Laboratoire')

  return `mailto:${supplier.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(bodyLines.join('\n'))}`
}

const getSupplierRestockItems = (supplierId: number) =>
  items.value
    .filter((item) => item.supplierId === supplierId)
    .map((item) => ({
      name: item.name,
      supplierRef: item.supplierRef,
      quantityToRestock: getRestockGap(item) ?? 0,
    }))
    .filter((item) => item.quantityToRestock > 0)

const buildSupplierRestockMailto = (supplier: Supplier) => {
  const restockItems = getSupplierRestockItems(supplier.id)
  return buildRestockMailto(
    supplier,
    restockItems,
    'Pouvez-vous préparer le réapprovisionnement des articles suivants',
  )
}

const buildSingleItemRestockMailto = (reportItem: RestockReportItem) => {
  const supplier = getSupplierForReportItem(reportItem)

  if (!supplier) {
    return null
  }

  return buildRestockMailto(
    supplier,
    [
      {
        name: reportItem.name,
        supplierRef: reportItem.supplierRef,
        quantityToRestock: reportItem.quantityToRestock,
      },
    ],
    'Pouvez-vous préparer le réapprovisionnement de l\'article suivant',
  )
}

const openMailDraft = (mailtoUrl: string | null, fallbackMessage: string) => {
  if (!mailtoUrl) {
    error.value = fallbackMessage
    return
  }

  window.location.href = mailtoUrl
}

const scrollToSection = async (
  sectionRef: typeof supplierFormSection,
  sectionName: 'supplier' | 'item',
) => {
  await nextTick()
  sectionRef.value?.scrollIntoView({
    behavior: 'smooth',
    block: 'start',
  })

  highlightedSection.value = sectionName

  if (sectionHighlightTimeout) {
    clearTimeout(sectionHighlightTimeout)
  }

  sectionHighlightTimeout = setTimeout(() => {
    highlightedSection.value = null
  }, 1800)
}

const sendSingleRestockRequest = (reportItem: RestockReportItem) => {
  openMailDraft(
    buildSingleItemRestockMailto(reportItem),
    `Impossible de préparer le mail pour ${reportItem.name} : fournisseur ou email introuvable.`,
  )
}

const exportRestockCsv = () => {
  if (itemsToRestock.value.length === 0) {
    error.value = 'Aucun article à exporter pour le réapprovisionnement.'
    return
  }

  const header = [
    'Article',
    'Ref interne',
    'Fournisseur',
    'Ref fournisseur',
    'Stock actuel',
    'Stock mini',
    'Stock max',
    'Quantite a reapprovisionner',
    'Prix total',
  ]

  const rows = itemsToRestock.value.map((item) => [
    item.name,
    item.internalRef ?? '',
    item.supplierName ?? '',
    item.supplierRef ?? '',
    String(item.quantity),
    String(getReportItemThreshold(item)),
    String(item.stockMax ?? ''),
    String(item.quantityToRestock),
    String(getReportItemTotalPrice(item) ?? ''),
  ])

  const csvContent = [header, ...rows]
    .map((row) => row.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(';'))
    .join('\n')

  const file = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(file)
  const link = document.createElement('a')
  link.href = url
  link.download = `reapprovisionnement-labo-${new Date().toISOString().slice(0, 10)}.csv`
  link.click()
  URL.revokeObjectURL(url)
}

const toggleInventorySortDirection = () => {
  inventorySortDirection.value = inventorySortDirection.value === 'asc' ? 'desc' : 'asc'
}

const fetchItems = async () => {
  try {
    const response = await apiClient.get<Item[]>('/items')
    items.value = response.data
    decrementAmounts.value = Object.fromEntries(
      response.data
        .filter((item): item is Item & { id: number } => typeof item.id === 'number')
        .map((item) => [item.id, decrementAmounts.value[item.id] ?? 1]),
    )
  } catch (err) {
    error.value = getErrorMessage(err, 'Erreur lors du chargement des articles.')
  }
}

const fetchSuppliers = async () => {
  try {
    const response = await apiClient.get<Supplier[]>('/suppliers')
    suppliers.value = response.data
  } catch (err) {
    error.value = getErrorMessage(err, 'Erreur lors du chargement des fournisseurs.')
  }
}

const submitSupplierForm = async () => {
  error.value = null
  successMessage.value = null

  try {
    const isEditingSupplier = editingSupplierId.value !== null
    const payload = {
      name: supplierForm.value.name.trim(),
      contact: supplierForm.value.contact.trim(),
      email: supplierForm.value.email.trim(),
    }

    const response = isEditingSupplier
      ? await apiClient.patch<Supplier>(`/suppliers/${editingSupplierId.value}`, payload)
      : await apiClient.post<Supplier>('/suppliers', payload)

    await fetchSuppliers()
    formItem.value.supplierId = response.data.id
    cancelSupplierEdit()
    successMessage.value = isEditingSupplier
      ? `Fournisseur ${response.data.name} mis à jour.`
      : `Fournisseur ${response.data.name} ajouté et sélectionné pour l'article.`
  } catch (err) {
    error.value = getErrorMessage(err, "Erreur lors de l'enregistrement du fournisseur.")
  }
}

const editSupplier = (supplier: Supplier) => {
  editingSupplierId.value = supplier.id
  supplierForm.value = {
    name: supplier.name,
    contact: supplier.contact,
    email: supplier.email,
  }

  void scrollToSection(supplierFormSection, 'supplier')
}

const cancelSupplierEdit = () => {
  editingSupplierId.value = null
  supplierForm.value = {
    name: '',
    contact: '',
    email: '',
  }
}

const deleteSupplier = async (supplier: Supplier) => {
  if (isSupplierUsed(supplier.id)) {
    error.value = `Impossible de supprimer ${supplier.name} : ce fournisseur est encore utilisé par des articles.`
    return
  }

  if (!window.confirm(`Supprimer le fournisseur ${supplier.name} ?`)) {
    return
  }

  try {
    await apiClient.delete(`/suppliers/${supplier.id}`)
    if (formItem.value.supplierId === supplier.id) {
      formItem.value.supplierId = null
    }
    if (editingSupplierId.value === supplier.id) {
      cancelSupplierEdit()
    }
    await fetchSuppliers()
    successMessage.value = `Fournisseur ${supplier.name} supprimé.`
  } catch (err) {
    error.value = getErrorMessage(err, 'Erreur lors de la suppression du fournisseur.')
  }
}

const fetchRestockReport = async () => {
  try {
    const response = await apiClient.get<RestockReportItem[]>('/items/restock-report')
    restockReport.value = response.data
  } catch (err) {
    error.value = getErrorMessage(err, 'Erreur lors du chargement du rapport de réapprovisionnement.')
  }
}

const refreshInventoryData = async () => {
  await Promise.all([fetchItems(), fetchRestockReport()])
}

const checkAuth = async () => {
  const token = localStorage.getItem('token')
  if (!token) {
    return
  }

  isAuthenticated.value = true
  error.value = null
  await nextTick()
  await Promise.all([refreshInventoryData(), fetchSuppliers()])
}

const logout = () => {
  localStorage.removeItem('token')
  isAuthenticated.value = false
  items.value = []
  suppliers.value = []
  restockReport.value = []
  editingId.value = null
  editingSupplierId.value = null
  formItem.value = createEmptyFormItem()
  cancelSupplierEdit()
}

const submitForm = async () => {
  error.value = null
  successMessage.value = null

  try {
    const payload = buildItemPayload()

    if (editingId.value) {
      await apiClient.patch(`/items/${editingId.value}`, payload)
      successMessage.value = 'Article mis à jour.'
    } else {
      await apiClient.post('/items', payload)
      successMessage.value = 'Article ajouté.'
    }

    await refreshInventoryData()
    cancelEdit()
  } catch (err) {
    error.value = getErrorMessage(err, "Erreur lors de l'enregistrement.")
  }
}

const useItem = async (item: Item) => {
  if (!item.id) {
    return
  }

  const qty = decrementAmounts.value[item.id]

  if (qty === undefined || !Number.isInteger(qty) || qty <= 0) {
    error.value = 'Quantité invalide.'
    return
  }

  try {
    await apiClient.post(`/items/${item.id}/decrement`, { amount: qty })
    decrementAmounts.value[item.id] = 1
    successMessage.value = `Stock mis à jour pour ${item.name}.`
    await refreshInventoryData()
  } catch (err) {
    error.value = getErrorMessage(err, 'Erreur de mise à jour du stock.')
  }
}

const deleteItem = async (id: number) => {
  if (!window.confirm('Supprimer cet article ?')) {
    return
  }

  try {
    await apiClient.delete(`/items/${id}`)
    successMessage.value = 'Article supprimé.'
    await refreshInventoryData()
  } catch (err) {
    error.value = getErrorMessage(err, 'Erreur de suppression.')
  }
}

const editItem = (item: Item) => {
  editingId.value = item.id ?? null
  formItem.value = {
    ...item,
    price: item.price ?? null,
    stockMax: item.stockMax ?? null,
    lowStockThreshold: item.lowStockThreshold ?? 5,
    supplierId: item.supplierId ?? null,
  }

  void scrollToSection(itemFormSection, 'item')
}

const cancelEdit = () => {
  editingId.value = null
  formItem.value = createEmptyFormItem()
}

onMounted(() => {
  checkAuth()
})

onUnmounted(() => {
  if (sectionHighlightTimeout) {
    clearTimeout(sectionHighlightTimeout)
  }
})
</script>

<template>
  <div v-if="!isAuthenticated">
    <Login @login-success="checkAuth" />
  </div>

  <main v-else class="page-shell">
    <section class="hero-panel">
      <div>
        <p class="eyebrow">Pilotage du stock labo</p>
        <h1>Suivi Stock et réapprovisionnement</h1>
        <p class="hero-copy">
          Comparez le stock actuel au stock cible pour transmettre au magasin central les quantités à
          réapprovisionner par article.
        </p>
      </div>

      <div class="hero-actions">
        <div class="session-badge">Session active : Administrateur</div>
        <button @click="logout" class="btn btn-secondary">Déconnexion</button>
      </div>
    </section>

    <div v-if="error" class="alert error">{{ error }}</div>
    <div v-if="successMessage" class="alert success">{{ successMessage }}</div>

    <section v-if="lowStockItems.length > 0" class="stock-alert-panel">
      <div class="stock-alert-header">
        <div>
          <p class="section-kicker alert-kicker">Alerte seuil bas</p>
          <h2>{{ lowStockItems.length }} article(s) ont atteint leur seuil critique</h2>
        </div>
        <span class="alert-total">Action recommandée immédiate</span>
      </div>

      <div class="stock-alert-list">
        <article v-for="item in lowStockItems" :key="item.id" class="stock-alert-item">
          <strong>{{ item.name }}</strong>
          <span>
            Stock actuel : {{ item.quantity }} | Seuil : {{ getItemThreshold(item) }}
          </span>
          <span v-if="getRestockGap(item) !== null">
            Manque estimé : {{ getRestockGap(item) }}
          </span>
        </article>
      </div>
    </section>

    <!-- <section class="summary-grid">
      <article class="summary-card">
        <span class="summary-label">Articles suivis</span>
        <strong>{{ items.length }}</strong>
      </article>
      <article class="summary-card accent-card">
        <span class="summary-label">Articles à réapprovisionner</span>
        <strong>{{ itemsToRestock.length }}</strong>
      </article>
      <article class="summary-card">
        <span class="summary-label">Quantité totale à recommander</span>
        <strong>{{ totalMissingQuantity }}</strong>
      </article>
      <article class="summary-card">
        <span class="summary-label">Taux moyen de couverture</span>
        <strong>{{ averageFillRate !== null ? `${averageFillRate}%` : 'N/A' }}</strong>
      </article>
    </section> -->

    <section class="panel">
      <div class="panel-heading">
        <div>
          <p class="section-kicker">Inventaire détaillé</p>
          <h2>Vue opérationnelle</h2>
        </div>
      </div>

      <div class="inventory-toolbar">
        <div class="form-group inventory-search">
          <label for="inventorySearch">Recherche</label>
          <input
            id="inventorySearch"
            v-model="inventorySearch"
            type="text"
            placeholder="Nom, référence, fournisseur..."
          />
        </div>

        <div class="form-group">
          <label for="inventoryFilter">Filtre</label>
          <select id="inventoryFilter" v-model="inventoryFilter">
            <option value="all">Tous les articles</option>
            <option value="low">Sous seuil bas</option>
            <option value="restock">À réapprovisionner</option>
            <option value="ok">Stock normal</option>
          </select>
        </div>

        <div class="form-group">
          <label for="inventorySortKey">Trier par</label>
          <select id="inventorySortKey" v-model="inventorySortKey">
            <option value="name">Nom</option>
            <option value="supplier">Fournisseur</option>
            <option value="quantity">Stock actuel</option>
            <option value="stockMax">Stock max</option>
            <option value="gap">Écart au stock max</option>
          </select>
        </div>

        <div class="form-group sort-direction-group">
          <label>Ordre</label>
          <button type="button" @click="toggleInventorySortDirection" class="btn btn-secondary">
            {{ inventorySortDirection === 'asc' ? 'Croissant' : 'Décroissant' }}
          </button>
        </div>
      </div>

      <p class="inventory-result-count">
        {{ filteredInventoryItems.length }} article(s) affiché(s) sur {{ items.length }}.
      </p>

      <div v-if="filteredInventoryItems.length > 0" class="table-wrapper inventory-table-wrapper">
        <table>
          <thead>
            <tr>
              <th>Nom</th>
              <th>Réf. interne</th>
              <th>Fournisseur</th>
              <th>Réf. fournisseur</th>
              <th>Prix</th>
              <th>Stock</th>
              <th>Stock mini</th>
              <th>Stock max</th>
              <th>Écart</th>
              <th>P2</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="item in filteredInventoryItems"
              :key="item.id"
              :class="{ 'low-stock-row': isLowStockItem(item) }"
            >
              <td>{{ item.name }}</td>
              <td>{{ item.internalRef || '-' }}</td>
              <td>{{ item.supplier?.name || '-' }}</td>
              <td>{{ item.supplierRef || '-' }}</td>
              <td>{{ formatCurrency(item.price) }}</td>
              <td :class="{ 'low-stock': isLowStockItem(item) }">
                {{ item.quantity }}
                <span v-if="isLowStockItem(item)" class="stock-pill">Seuil atteint</span>
              </td>
              <td>{{ getItemThreshold(item) }}</td>
              <td>{{ item.stockMax ?? '-' }}</td>
              <td>{{ getRestockGap(item) ?? '-' }}</td>
              <td>{{ item.isP2 ? 'Oui' : 'Non' }}</td>
              <td class="actions-cell">
                <div class="use-action">
                  <input
                    v-if="item.id"
                    v-model.number="decrementAmounts[item.id]"
                    type="number"
                    min="1"
                    class="small-input"
                  />
                  <button
                    @click="useItem(item)"
                    class="btn btn-warning btn-sm"
                    :disabled="item.quantity === 0"
                  >
                    Utiliser
                  </button>
                </div>
                <div class="manage-actions">
                  <button @click="editItem(item)" class="btn btn-info btn-sm">Éditer</button>
                  <button @click="deleteItem(item.id!)" class="btn btn-danger btn-sm">Supprimer</button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <p v-else class="empty-state">Aucun article ne correspond aux critères de recherche ou de filtre.</p>
    </section>

    <section class="panel">
      <div class="panel-heading report-heading">
        <div>
          <p class="section-kicker">Réapprovisionnement</p>
          <h2>Préparation pour le magasin central</h2>
        </div>

        <button @click="exportRestockCsv" class="btn btn-primary" :disabled="itemsToRestock.length === 0">
          Export CSV
        </button>
      </div>

      <div v-if="itemsToRestock.length > 0" class="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>Article</th>
              <th>Réf. interne</th>
              <th>Fournisseur</th>
              <th>Réf. fournisseur</th>
              <th>Stock actuel</th>
              <th>Stock mini</th>
              <th>Stock max</th>
              <th>À réapprovisionner</th>
              <th>Prix total</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="item in itemsToRestock" :key="item.id">
              <td>{{ item.name }}</td>
              <td>{{ item.internalRef || '-' }}</td>
              <td>{{ item.supplierName || '-' }}</td>
              <td>{{ item.supplierRef || '-' }}</td>
              <td>{{ item.quantity }}</td>
              <td>{{ getReportItemThreshold(item) }}</td>
              <td>{{ item.stockMax ?? '-' }}</td>
              <td class="restock-gap">{{ item.quantityToRestock }}</td>
              <td>{{ formatCurrency(getReportItemTotalPrice(item)) }}</td>
              <td>
                <div class="restock-actions">
                  <button
                    type="button"
                    class="btn btn-info btn-sm"
                    @click="sendSingleRestockRequest(item)"
                  >
                    Envoyer cet article
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <p v-else class="empty-state">
        Tous les articles avec un stock max défini sont au niveau attendu. Aucun réapprovisionnement à transmettre.
      </p>
    </section>

    <section
      ref="itemFormSection"
      :class="['panel', { 'panel-highlighted': highlightedSection === 'item' }]"
    >
      <div class="panel-heading">
        <div>
          <p class="section-kicker">Paramétrage article</p>
          <h2>{{ editingId ? 'Modifier un article' : 'Ajouter un article' }}</h2>
        </div>
      </div>

      <form @submit.prevent="submitForm" class="item-form">
        <div class="form-group wide">
          <label for="name">Nom</label>
          <input id="name" v-model="formItem.name" type="text" required />
        </div>

        <div class="form-group">
          <label for="internalRef">Réf. interne</label>
          <input id="internalRef" v-model="formItem.internalRef" type="text" />
        </div>

        <div class="form-group">
          <label for="supplier">Fournisseur</label>
          <select id="supplier" v-model="formItem.supplierId">
            <option :value="null">-- Sélectionner --</option>
            <option v-for="supplier in suppliers" :key="supplier.id" :value="supplier.id">
              {{ supplier.name }}
            </option>
          </select>
        </div>

        <div class="form-group">
          <label for="supplierRef">Réf. fournisseur</label>
          <input id="supplierRef" v-model="formItem.supplierRef" type="text" required />
        </div>

        <div class="form-group">
          <label for="price">Prix unitaire</label>
          <input id="price" v-model.number="formItem.price" type="number" step="0.01" min="0" />
        </div>

        <div class="form-group">
          <label for="quantity">Stock actuel</label>
          <input id="quantity" v-model.number="formItem.quantity" type="number" min="0" required />
        </div>

        <div class="form-group">
          <label for="stockMax">Stock max</label>
          <input id="stockMax" v-model.number="formItem.stockMax" type="number" min="0" />
        </div>

        <div class="form-group">
          <label for="threshold">Seuil d'alerte</label>
          <input
            id="threshold"
            v-model.number="formItem.lowStockThreshold"
            type="number"
            min="0"
          />
        </div>

        <label class="checkbox-group">
          <input v-model="formItem.isP2" type="checkbox" />
          <span>Zone P2</span>
        </label>

        <div class="form-actions">
          <button type="submit" class="btn btn-primary">
            {{ editingId ? 'Mettre à jour' : 'Enregistrer' }}
          </button>
          <button v-if="editingId" type="button" @click="cancelEdit" class="btn btn-secondary">
            Annuler
          </button>
        </div>
      </form>
    </section>

    <section
      ref="supplierFormSection"
      :class="['panel', { 'panel-highlighted': highlightedSection === 'supplier' }]"
    >
      <div class="panel-heading">
        <div>
          <p class="section-kicker">Fournisseurs</p>
          <h2>Créer et consulter les fournisseurs référencés</h2>
        </div>
      </div>

      <div class="suppliers-layout">
        <form @submit.prevent="submitSupplierForm" class="supplier-form-panel">
          <div class="form-group">
            <label for="supplierName">Nom du fournisseur</label>
            <input id="supplierName" v-model="supplierForm.name" type="text" required />
          </div>

          <div class="form-group">
            <label for="supplierContact">Contact</label>
            <input id="supplierContact" v-model="supplierForm.contact" type="text" required />
          </div>

          <div class="form-group">
            <label for="supplierEmail">Email</label>
            <input id="supplierEmail" v-model="supplierForm.email" type="email" required />
          </div>

          <div class="supplier-form-actions">
            <button type="submit" class="btn btn-primary">
              {{ editingSupplierId ? 'Mettre à jour le fournisseur' : 'Ajouter le fournisseur' }}
            </button>
            <button
              v-if="editingSupplierId"
              type="button"
              class="btn btn-secondary"
              @click="cancelSupplierEdit"
            >
              Annuler
            </button>
          </div>
        </form>

        <div class="suppliers-list-panel">
          <div class="suppliers-list-header">
            <span>{{ filteredSuppliers.length }} fournisseur(s) affiché(s)</span>
            <span class="subtle-note">Les 3 derniers par défaut, ou tous les résultats via la recherche</span>
          </div>

          <div class="form-group supplier-search-group">
            <label for="supplierSearch">Rechercher un fournisseur</label>
            <input
              id="supplierSearch"
              v-model="supplierSearch"
              type="text"
              placeholder="Nom du fournisseur, contact ou email"
            />
          </div>

          <div v-if="filteredSuppliers.length > 0" class="supplier-list-wrapper">
            <div class="supplier-list-head supplier-list-row">
              <span>Fournisseur</span>
              <span>Contact</span>
              <span>Email</span>
              <span>Articles liés</span>
              <span>Actions</span>
            </div>

            <article v-for="supplier in filteredSuppliers" :key="supplier.id" class="supplier-list-row supplier-list-item">
              <strong>{{ supplier.name }}</strong>
              <span>{{ supplier.contact }}</span>
              <a
                :href="buildSupplierRestockMailto(supplier)"
                :title="`Envoyer une demande de réapprovisionnement à ${supplier.contact}`"
              >
                {{ supplier.email }}
              </a>
              <span class="supplier-usage">
                {{ getSupplierItemCount(supplier.id) }} article(s)
              </span>
              <div class="supplier-actions">
                <button type="button" class="btn btn-info btn-sm" @click="editSupplier(supplier)">
                  Éditer
                </button>
                <button
                  type="button"
                  class="btn btn-danger btn-sm"
                  @click="deleteSupplier(supplier)"
                  :disabled="isSupplierUsed(supplier.id)"
                  :title="isSupplierUsed(supplier.id) ? 'Suppression bloquée : fournisseur utilisé par des articles.' : 'Supprimer ce fournisseur'"
                >
                  Supprimer
                </button>
              </div>
            </article>
          </div>
          <p v-else class="empty-state">Aucun fournisseur ne correspond à la recherche.</p>
        </div>
      </div>
    </section>



  </main>
</template>

<style scoped>
:global(body) {
  margin: 0;
  background:
    radial-gradient(circle at top left, rgba(188, 221, 255, 0.48), transparent 28%),
    linear-gradient(180deg, #f3f8fc 0%, #e6eef6 100%);
  color: #1f2a37;
}

.page-shell {
  width: min(1380px, calc(100vw - 32px));
  margin: 0 auto;
  display: grid;
  gap: 24px;
  padding: 24px 0 48px;
}

.hero-panel,
.panel,
.summary-card {
  border: 1px solid rgba(18, 56, 96, 0.08);
  background: rgba(255, 255, 255, 0.9);
  box-shadow: 0 18px 50px rgba(40, 71, 103, 0.08);
}

.hero-panel {
  display: flex;
  justify-content: space-between;
  gap: 24px;
  padding: 28px;
  border-radius: 28px;
}

.eyebrow,
.section-kicker,
.summary-label {
  margin: 0 0 8px;
  text-transform: uppercase;
  letter-spacing: 0.12em;
  font-size: 0.72rem;
  color: #4f6b88;
}

h1,
h2,
p {
  margin: 0;
}

h1 {
  max-width: 780px;
  font-size: clamp(2rem, 3vw, 3.4rem);
  line-height: 1.05;
  color: #123860;
}

h2 {
  font-size: 1.35rem;
  color: #14344f;
}

.hero-copy {
  max-width: 760px;
  margin-top: 14px;
  line-height: 1.6;
  color: #526272;
}

.hero-actions {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 12px;
}

.session-badge {
  padding: 10px 14px;
  border-radius: 999px;
  background: #dce9f8;
  color: #123860;
  font-weight: 700;
}

.summary-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 16px;
}

.summary-card {
  padding: 20px;
  border-radius: 22px;
}

.summary-card strong {
  font-size: 2rem;
  color: #0f2d4a;
}

.accent-card {
  background: linear-gradient(135deg, #123860 0%, #1f6c83 100%);
}

.accent-card .summary-label,
.accent-card strong {
  color: #f6fbff;
}

.panel {
  padding: 24px;
  border-radius: 28px;
}

.panel-highlighted {
  border-color: rgba(201, 103, 43, 0.42);
  box-shadow:
    0 0 0 5px rgba(201, 103, 43, 0.14),
    0 18px 50px rgba(40, 71, 103, 0.08);
  animation: panel-pulse 1.6s ease-out;
}

@keyframes panel-pulse {
  0% {
    transform: translateY(-2px);
    box-shadow:
      0 0 0 0 rgba(201, 103, 43, 0.28),
      0 18px 50px rgba(40, 71, 103, 0.08);
  }

  45% {
    transform: translateY(0);
    box-shadow:
      0 0 0 8px rgba(201, 103, 43, 0.1),
      0 18px 50px rgba(40, 71, 103, 0.08);
  }

  100% {
    box-shadow:
      0 0 0 5px rgba(201, 103, 43, 0.14),
      0 18px 50px rgba(40, 71, 103, 0.08);
  }
}

.stock-alert-panel {
  padding: 22px;
  border-radius: 24px;
  border: 1px solid rgba(191, 75, 44, 0.18);
  background: linear-gradient(135deg, rgba(255, 238, 232, 0.95) 0%, rgba(255, 247, 236, 0.98) 100%);
  box-shadow: 0 16px 34px rgba(191, 75, 44, 0.08);
}

.stock-alert-header {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  align-items: center;
  margin-bottom: 16px;
}

.alert-kicker {
  color: #a14a23;
}

.alert-total {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 10px 14px;
  border-radius: 999px;
  background: rgba(191, 75, 44, 0.12);
  color: #8f3e1e;
  font-weight: 800;
}

.stock-alert-list {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 12px;
}

.stock-alert-item {
  display: grid;
  gap: 4px;
  padding: 14px 16px;
  border-radius: 18px;
  background: rgba(255, 255, 255, 0.82);
  border: 1px solid rgba(191, 75, 44, 0.12);
  color: #6e3a27;
}

.suppliers-layout {
  display: grid;
  grid-template-columns: minmax(280px, 360px) minmax(0, 1fr);
  gap: 18px;
}

.supplier-form-panel,
.suppliers-list-panel {
  padding: 18px;
  border-radius: 20px;
  border: 1px solid rgba(18, 56, 96, 0.08);
  background: #f9fbfd;
}

.supplier-form-panel {
  display: grid;
  gap: 14px;
  align-content: start;
}

.supplier-form-actions {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}

.suppliers-list-panel {
  display: grid;
  gap: 14px;
}

.supplier-search-group {
  max-width: 460px;
}

.suppliers-list-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  color: #35526c;
  font-weight: 700;
}

.subtle-note {
  font-size: 0.84rem;
  color: #668098;
  font-weight: 600;
}

.supplier-list-wrapper {
  display: grid;
  gap: 10px;
}

.supplier-list-row {
  display: grid;
  grid-template-columns: minmax(140px, 1.4fr) minmax(120px, 1fr) minmax(190px, 1.2fr) minmax(110px, 0.7fr) minmax(170px, 1fr);
  gap: 12px;
  align-items: center;
}

.supplier-list-head {
  padding: 0 14px;
  color: #53708c;
  font-size: 0.79rem;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.supplier-list-item {
  padding: 14px 16px;
  border-radius: 18px;
  border: 1px solid #dde7f0;
  background: #fff;
  color: #26435d;
}

.supplier-usage {
  color: #587088;
  font-weight: 700;
}

.supplier-actions {
  display: flex;
  gap: 8px;
  margin-top: 6px;
  flex-wrap: wrap;
}

.supplier-list-item a {
  color: #1f6c83;
  word-break: break-word;
}

.panel-heading,
.report-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 20px;
}

.item-form {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 16px;
  align-items: end;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.form-group.wide {
  grid-column: span 2;
}

.checkbox-group {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  min-height: 48px;
  font-weight: 600;
  color: #20415d;
}

.form-actions {
  display: flex;
  gap: 12px;
  justify-content: flex-end;
  grid-column: 1 / -1;
}

.inventory-toolbar {
  display: grid;
  grid-template-columns: minmax(260px, 2fr) repeat(3, minmax(0, 1fr));
  gap: 16px;
  align-items: end;
  margin-bottom: 14px;
}

.inventory-search {
  min-width: 0;
}

.sort-direction-group {
  align-self: stretch;
}

.inventory-result-count {
  margin-bottom: 14px;
  color: #5a7187;
  font-weight: 600;
}

label {
  font-size: 0.92rem;
  font-weight: 700;
  color: #2a465f;
}

input,
select {
  min-height: 46px;
  padding: 0 14px;
  border: 1px solid #c9d8e6;
  border-radius: 14px;
  background: #f9fbfd;
  color: #17324f;
  font: inherit;
}

input:focus,
select:focus {
  outline: none;
  border-color: #1f6c83;
  box-shadow: 0 0 0 4px rgba(31, 108, 131, 0.12);
}

.btn {
  min-height: 42px;
  padding: 0 16px;
  border: none;
  border-radius: 999px;
  font-weight: 700;
  cursor: pointer;
  transition:
    transform 0.18s ease,
    box-shadow 0.18s ease,
    opacity 0.18s ease;
}

.btn:hover {
  transform: translateY(-1px);
}

.btn:disabled {
  cursor: not-allowed;
  opacity: 0.55;
  transform: none;
}

.btn-primary {
  background: linear-gradient(135deg, #c9672b 0%, #f1a238 100%);
  color: #fff;
  box-shadow: 0 12px 26px rgba(201, 103, 43, 0.2);
}

.btn-secondary {
  background: #dce9f8;
  color: #123860;
}

.btn-warning {
  background: #f0b34f;
  color: #4f2c00;
}

.btn-info {
  background: #7fc2d8;
  color: #083349;
}

.btn-danger {
  background: #d95d5d;
  color: #fff;
}

.btn-sm {
  min-height: 34px;
  padding: 0 12px;
  font-size: 0.86rem;
}

.alert {
  padding: 14px 18px;
  border-radius: 18px;
  border: 1px solid transparent;
  font-weight: 600;
}

.error {
  background: rgba(217, 93, 93, 0.1);
  border-color: rgba(217, 93, 93, 0.16);
  color: #8f2323;
}

.success {
  background: rgba(71, 152, 93, 0.12);
  border-color: rgba(71, 152, 93, 0.18);
  color: #245f33;
}

.table-wrapper {
  overflow-x: auto;
}

.inventory-table-wrapper {
  max-height: calc(25 * 52px + 58px);
  overflow: auto;
  border-radius: 18px;
}

table {
  width: 100%;
  border-collapse: collapse;
}

th,
td {
  padding: 14px 12px;
  border-bottom: 1px solid #e2ebf3;
  text-align: left;
  vertical-align: middle;
}

th {
  position: sticky;
  top: 0;
  z-index: 1;
  background: #f9fbfd;
  font-size: 0.8rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: #53708c;
}

tbody tr:hover {
  background: rgba(220, 233, 248, 0.32);
}

.low-stock-row {
  background: rgba(255, 239, 235, 0.55);
}

.low-stock,
.restock-gap {
  font-weight: 800;
  color: #bf4b2c;
}

.stock-pill {
  display: inline-flex;
  align-items: center;
  margin-left: 8px;
  padding: 4px 8px;
  border-radius: 999px;
  background: rgba(191, 75, 44, 0.12);
  color: #9d4120;
  font-size: 0.75rem;
  font-weight: 800;
  vertical-align: middle;
}

.coverage-cell {
  display: flex;
  align-items: center;
  gap: 10px;
}

.coverage-bar {
  width: 110px;
  height: 9px;
  border-radius: 999px;
  background: #e5edf5;
  overflow: hidden;
}

.coverage-bar span {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: linear-gradient(90deg, #d95d5d 0%, #f1a238 55%, #2f8f6b 100%);
}

.restock-actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.actions-cell,
.use-action,
.manage-actions {
  display: flex;
  gap: 8px;
  align-items: center;
  flex-wrap: wrap;
}

.actions-cell {
  min-width: 220px;
  flex-direction: column;
  align-items: stretch;
}

.small-input {
  width: 72px;
  min-height: 34px;
  padding: 0 10px;
}

.empty-state {
  padding: 20px;
  border-radius: 18px;
  background: #f6f9fc;
  color: #496176;
}

@media (max-width: 1100px) {
  .summary-grid,
  .item-form,
  .inventory-toolbar {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .supplier-list-row {
    grid-template-columns: minmax(140px, 1fr) minmax(120px, 1fr) minmax(190px, 1.2fr) minmax(100px, 0.8fr);
  }

  .supplier-list-head span:last-child {
    display: none;
  }

  .supplier-list-item .supplier-actions {
    grid-column: 1 / -1;
  }

  .suppliers-layout {
    grid-template-columns: 1fr;
  }

  .hero-panel {
    flex-direction: column;
  }

  .stock-alert-header,
  .hero-actions {
    align-items: flex-start;
  }
}

@media (max-width: 720px) {
  .page-shell {
    width: min(100vw - 20px, 1380px);
    padding: 14px 0 32px;
  }

  .summary-grid,
  .item-form,
  .inventory-toolbar {
    grid-template-columns: 1fr;
  }

  .form-group.wide,
  .form-actions {
    grid-column: auto;
  }

  .panel,
  .hero-panel,
  .summary-card {
    border-radius: 20px;
  }

  .panel-heading,
  .report-heading,
  .stock-alert-header,
  .form-actions {
    flex-direction: column;
    align-items: stretch;
  }

  .suppliers-list-header,
  .supplier-list-row {
    grid-template-columns: 1fr;
  }

  .supplier-list-head {
    display: none;
  }

  .btn,
  .btn-sm {
    width: 100%;
  }

  .supplier-form-actions,
  .restock-actions,
  .supplier-actions,
  .use-action,
  .manage-actions {
    flex-direction: column;
    align-items: stretch;
  }

  .small-input {
    width: 100%;
  }
}
</style>

<!-- eslint-disable @typescript-eslint/no-unused-vars -->
<!-- eslint-disable @typescript-eslint/no-explicit-any -->
<script setup lang="ts">
import { ref, onMounted, nextTick } from 'vue'
import { apiClient } from './services/api'
import Login from './components/Login.vue'

// --- TYPES ---
interface Supplier {
  id: number
  name: string
}

interface Item {
  id?: number
  name: string
  internalRef?: string
  supplierRef: string
  price?: number
  quantity: number
  isP2: boolean
  lowStockThreshold?: number
  supplierId?: number | null
  supplier?: Supplier
}

// --- ÉTAT ---
const isAuthenticated = ref(false)
const items = ref<Item[]>([])
const suppliers = ref<Supplier[]>([])
const error = ref<string | null>(null)
const successMessage = ref<string | null>(null)

const editingId = ref<number | null>(null)
const decrementAmounts = ref<Record<number, number>>({})

const formItem = ref<Item>({
  name: '',
  internalRef: '',
  supplierRef: '',
  price: 0,
  quantity: 0,
  isP2: false,
  lowStockThreshold: 5,
  supplierId: null,
})

// --- LOGIQUE AUTHENTIFICATION ---
const checkAuth = async () => {
  const token = localStorage.getItem('token')
  if (token) {
    isAuthenticated.value = true
    error.value = null // On réinitialise l'erreur avant de charger

    // On attend un cycle d'horloge pour que l'intercepteur Axios soit prêt
    await nextTick()

    fetchItems()
    fetchSuppliers()
  }
}

const logout = () => {
  localStorage.removeItem('token')
  isAuthenticated.value = false
  items.value = []
  suppliers.value = []
}

// --- MÉTHODES API ---
const fetchItems = async () => {
  try {
    const response = await apiClient.get<Item[]>('/items')
    items.value = response.data
    response.data.forEach((item) => {
      if (item.id) decrementAmounts.value[item.id] = 1
    })
  } catch (err: any) {
    if (err.response?.status === 401) logout()
    error.value = 'Erreur lors du chargement des équipements.'
  }
}

const fetchSuppliers = async () => {
  try {
    const response = await apiClient.get<Supplier[]>('/suppliers')
    suppliers.value = response.data
  } catch (err) {
    console.error('Erreur fournisseurs:', err)
  }
}

const submitForm = async () => {
  error.value = null
  successMessage.value = null

  const payload = {
    name: formItem.value.name,
    internalRef: formItem.value.internalRef || null,
    supplierRef: formItem.value.supplierRef,
    price: formItem.value.price ? Number(formItem.value.price) : 0,
    quantity: Number(formItem.value.quantity),
    isP2: Boolean(formItem.value.isP2),
    lowStockThreshold: Number(formItem.value.lowStockThreshold),
    supplierId: formItem.value.supplierId ? Number(formItem.value.supplierId) : null,
  }

  try {
    if (editingId.value) {
      const response = await apiClient.patch<Item>(`/items/${editingId.value}`, payload)
      const index = items.value.findIndex((i) => i.id === editingId.value)
      if (index !== -1) items.value[index] = response.data
      successMessage.value = 'Équipement mis à jour.'
    } else {
      const response = await apiClient.post<Item>('/items', payload)
      items.value.push(response.data)
      if (response.data.id) decrementAmounts.value[response.data.id] = 1
      successMessage.value = 'Équipement ajouté.'
    }
    cancelEdit()
  } catch (err: any) {
    error.value = err.response?.data?.message || "Erreur lors de l'enregistrement."
  }
}

const useItem = async (item: Item) => {
  if (!item.id) return
  const qty = parseInt(String(decrementAmounts.value[item.id]), 10)

  if (isNaN(qty) || qty <= 0) {
    alert('Quantité invalide.')
    return
  }

  try {
    const response = await apiClient.post<Item>(`/items/${item.id}/decrement`, { amount: qty })
    const index = items.value.findIndex((i) => i.id === item.id)
    if (index !== -1) items.value[index] = response.data
    decrementAmounts.value[item.id] = 1
    successMessage.value = `Stock mis à jour (${item.name}).`
  } catch (err: any) {
    error.value = err.response?.data?.message || 'Erreur de mise à jour du stock.'
  }
}

const deleteItem = async (id: number) => {
  if (!confirm('Supprimer cet élément ?')) return
  try {
    await apiClient.delete(`/items/${id}`)
    items.value = items.value.filter((item) => item.id !== id)
    successMessage.value = 'Supprimé avec succès.'
  } catch (err) {
    error.value = 'Erreur de suppression.'
  }
}

const editItem = (item: Item) => {
  editingId.value = item.id as number
  formItem.value = { ...item }
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

const cancelEdit = () => {
  editingId.value = null
  formItem.value = {
    name: '',
    internalRef: '',
    supplierRef: '',
    price: 0,
    quantity: 0,
    isP2: false,
    lowStockThreshold: 5,
    supplierId: null,
  }
}

onMounted(() => {
  checkAuth()
})
</script>

<template>
  <div v-if="!isAuthenticated">
    <Login @login-success="checkAuth" />
  </div>

  <main v-else class="container">
    <div class="auth-header">
      <span>Session active : Administrateur</span>
      <button @click="logout" class="btn-sm btn-secondary">Déconnexion</button>
    </div>

    <h1>Gestion de l'Inventaire</h1>

    <div v-if="error" class="alert error">{{ error }}</div>
    <div v-if="successMessage" class="alert success">{{ successMessage }}</div>

    <section class="form-section">
      <h2>{{ editingId ? 'Modifier' : 'Ajouter' }} un équipement</h2>
      <form @submit.prevent="submitForm" class="item-form">
        <div class="form-group">
          <label>Nom</label>
          <input type="text" v-model="formItem.name" required />
        </div>
        <div class="form-group">
          <label>Réf. Interne</label>
          <input type="text" v-model="formItem.internalRef" />
        </div>
        <div class="form-group">
          <label>Fournisseur</label>
          <select v-model="formItem.supplierId" class="select-input">
            <option :value="null">-- Sélectionner --</option>
            <option v-for="s in suppliers" :key="s.id" :value="s.id">{{ s.name }}</option>
          </select>
        </div>
        <div class="form-group">
          <label>Réf. Fournisseur</label>
          <input type="text" v-model="formItem.supplierRef" required />
        </div>
        <div class="form-group">
          <label>Prix (€)</label>
          <input type="number" step="0.01" v-model="formItem.price" min="0" />
        </div>
        <div class="form-group">
          <label>Quantité</label>
          <input type="number" v-model="formItem.quantity" min="0" required />
        </div>
        <div class="form-group checkbox">
          <label><input type="checkbox" v-model="formItem.isP2" /> Zone P2</label>
        </div>
        <div class="form-actions">
          <button type="submit" class="btn-primary">
            {{ editingId ? 'Mettre à jour' : 'Enregistrer' }}
          </button>
          <button type="button" v-if="editingId" @click="cancelEdit" class="btn-secondary">
            Annuler
          </button>
        </div>
      </form>
    </section>

    <section class="table-section">
      <table v-if="items.length > 0">
        <thead>
          <tr>
            <th>Nom</th>
            <th>Réf. Interne</th>
            <th>Fournisseur</th>
            <th>Prix</th>
            <th>Stock</th>
            <th>P2</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="item in items" :key="item.id">
            <td>{{ item.name }}</td>
            <td>{{ item.internalRef || '-' }}</td>
            <td>{{ item.supplier?.name || '-' }}</td>
            <td>{{ item.price ? item.price + ' €' : '-' }}</td>
            <td :class="{ 'low-stock': item.quantity <= (item.lowStockThreshold || 5) }">
              {{ item.quantity }}
            </td>
            <td>{{ item.isP2 ? 'Oui' : 'Non' }}</td>
            <td class="actions-cell">
              <div class="use-action">
                <input
                  type="number"
                  v-model.number="decrementAmounts[item.id!]"
                  min="1"
                  class="small-input"
                />
                <button
                  @click="useItem(item)"
                  class="btn-sm btn-warning"
                  :disabled="item.quantity === 0"
                >
                  Utiliser
                </button>
              </div>
              <div class="manage-actions">
                <button @click="editItem(item)" class="btn-sm btn-info">Éditer</button>
                <button @click="deleteItem(item.id!)" class="btn-sm btn-danger">X</button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
      <p v-else-if="!error">Inventaire vide.</p>
    </section>
  </main>
</template>

<style scoped>
.container {
  max-width: 1100px;
  margin: 1.5rem auto;
  font-family: sans-serif;
  color: #333;
}
.auth-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px;
  background: #eee;
  border-radius: 6px;
  margin-bottom: 2rem;
}
table {
  width: 100%;
  border-collapse: collapse;
  margin-top: 1rem;
}
th,
td {
  border: 1px solid #ddd;
  padding: 12px;
  text-align: left;
}
th {
  background: #f4f4f4;
}
.low-stock {
  color: #d9534f;
  font-weight: bold;
}
.alert {
  padding: 12px;
  border-radius: 4px;
  margin-bottom: 1rem;
}
.error {
  background: #f2dede;
  color: #a94442;
}
.success {
  background: #dff0d8;
  color: #3c763d;
}
.form-section {
  background: #f9f9f9;
  padding: 1.5rem;
  border-radius: 8px;
  margin-bottom: 2rem;
  border: 1px solid #eee;
}
.item-form {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
  align-items: flex-end;
}
.form-group {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
input,
select {
  padding: 8px;
  border: 1px solid #ccc;
  border-radius: 4px;
}
button {
  padding: 8px 14px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-weight: 600;
}
.btn-primary {
  background: #0275d8;
  color: white;
}
.btn-secondary {
  background: #6c757d;
  color: white;
}
.btn-warning {
  background: #f0ad4e;
  color: white;
}
.btn-info {
  background: #5bc0de;
  color: white;
}
.btn-danger {
  background: #d9534f;
  color: white;
}
.btn-sm {
  padding: 4px 8px;
  font-size: 0.85rem;
}
.actions-cell {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.use-action,
.manage-actions {
  display: flex;
  gap: 4px;
}
.small-input {
  width: 50px;
}

@media (prefers-color-scheme: dark) {
  .container {
    color: #ddd;
  }
  .auth-header {
    background: #222;
  }
  th {
    background: #222;
  }
  td {
    border-color: #444;
  }
  .form-section {
    background: #1a1a1a;
    border-color: #333;
  }
  input,
  select {
    background: #222;
    color: white;
    border-color: #444;
  }
}
</style>

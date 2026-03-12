<template>
  <div class="login-container">
    <form @submit.prevent="handleLogin" class="login-form">
      <h2>Connexion Inventaire</h2>
      <div class="form-group">
        <label>Utilisateur</label>
        <input v-model="username" type="text" required />
      </div>
      <div class="form-group">
        <label>Mot de passe</label>
        <input v-model="password" type="password" required />
      </div>
      <button type="submit" class="btn-primary">Se connecter</button>
      <p v-if="loginError" class="error">{{ loginError }}</p>
    </form>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { apiClient } from '../services/api';

const emit = defineEmits(['login-success']);
const username = ref('');
const password = ref('');
const loginError = ref('');

const handleLogin = async () => {
  try {
    const response = await apiClient.post('/auth/login', {
      username: username.value,
      password: password.value
    });

    // Stockage du jeton pour les futures requêtes
    localStorage.setItem('token', response.data.access_token);
    emit('login-success');
  } catch (err) {
    loginError.value = "Identifiants invalides.";
  }
};
</script>

<style scoped>
.login-container { display: flex; justify-content: center; margin-top: 100px; }
.login-form { background: #5b7acf; padding: 2rem; border-radius: 8px; width: 300px; }
.error { color: red; margin-top: 10px; }
</style>

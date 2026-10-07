<script lang="ts">
  import LandingPage from './components/LandingPage.svelte'
</script>

<div id="mainapp">
  <LandingPage />
</div>

<style>
  #mainapp {
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    width: 100%;
    min-height: 100vh;
    padding: 1.5rem;
    text-align: center;
  }
</style>

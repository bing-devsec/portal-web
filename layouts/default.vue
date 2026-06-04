<template>
    <div class="app">
        <Navigation class="navigation" />
        <div class="scrollable-content">
            <main class="content-wrapper">
                <slot></slot>
            </main>
            <SiteFooter />
        </div>
    </div>
</template>

<script setup lang="ts">
import Navigation from '~/components/Navigation.vue'
import SiteFooter from '~/components/SiteFooter.vue'
</script>

<style>
.app {
	display: flex;
	flex-direction: column;
	height: 100vh;
}

.navigation {
	position: sticky;
	top: 0;
	z-index: 1000;
}

.scrollable-content {
	flex: 1;
	overflow-y: auto;
	display: flex;
	flex-direction: column;
	overflow-x: hidden;
}

.content-wrapper {
	flex: 1 0 auto;
}
</style>
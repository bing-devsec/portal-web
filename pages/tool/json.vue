<template>
    <client-only>
        <AsyncJsonTool />
    </client-only>
</template>

<script setup lang="ts">
import { defineAsyncComponent } from "vue";

const AsyncJsonTool = defineAsyncComponent(
    () => import("~/components/JsonTool/JsonTool.client.vue")
);
</script>

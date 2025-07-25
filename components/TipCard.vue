<template>
    <div class="bg-fff box-shadow radius mb-5">
        <div class="tab-category">
            <a href="#"><strong class="current">{{ props.tipMsg }}</strong></a>
        </div>
    </div>
</template>

<script setup lang="ts">
const props = defineProps({ tipMsg: String })
</script>
<template>
    <div class="bg-fff box-shadow radius mb-20">
        <div class="tab-category">
            <a href="#"><strong>友情链接</strong></a>
        </div>
        <div class="tab-category-item">
            <div class="tags">
                <a v-for="link in friendLinks" :key="link.id" :href="link.url"
                    :class="`tags${link.randomClass} link-item`" target="_blank" rel="noopener noreferrer">
                    {{ link.name }}
                </a>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
interface Link {
    id: string;
    name: string;
    url: string;
    randomClass: string;
}

defineProps<{
    friendLinks: Link[];
}>();
</script>
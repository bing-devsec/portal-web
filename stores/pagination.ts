import { defineStore } from 'pinia'

interface PaginationState {
	currentPage: number;
	currentTagName: string;
	pageSize: number;
}

export const usePaginationStore = defineStore('pagination', {
	state: (): PaginationState => ({
		currentPage: 1,
		currentTagName: '',
		pageSize: 10
	}),
	actions: {
		setCurrentPage(page: number) {
			this.currentPage = page;
		},
		setCurrentTagName(tagName: string) {
			if (this.currentTagName !== tagName) {
				this.currentPage = 1;
			}
			this.currentTagName = tagName;
		},
		setPageSize(size: number) {
			this.pageSize = size;
		},
		resetPagination() {
			this.currentPage = 1;
		}
	}
})
import { defineStore } from "pinia";

interface UserGetArticleListItem {
	id: string;
	title: string;
	tagName: string;
	describe: string;
	createTime: string;
	updateTime: string;
	viewNum: number;
}

interface SearchState {
	searchResults: UserGetArticleListItem[];
	total: number;
	msg: string;
	page: number;
	pageSize: number;
	currentPage: number;
}

export const useSearchStore = defineStore("search", {
	state: (): SearchState => ({
		searchResults: [],
		total: 0,
		msg: "",
		page: 1,
		pageSize: 10,
		currentPage: 1,
	}),

	actions: {
		setSearchResults(data: { rows: UserGetArticleListItem[] }) {
			this.searchResults = data.rows;
		},
		
		setTotal(total: number) {
			this.total = total;
		},
		
		setMsg(msg: string) {
			this.msg = msg;
		},
		
		setPage(page: number) {
			this.page = page;
		},
		
		setPageSize(pageSize: number) {
			this.pageSize = pageSize;
		},
		
		setCurrentPage(page: number) {
			this.currentPage = page;
		},
		
		resetPagination() {
			this.currentPage = 1;
			this.page = 1;
		},
		
		clearResults() {
			this.searchResults = [];
			this.total = 0;
		}
	},
});
import { defineStore } from 'pinia'

export const useAppStore = defineStore('app', {
  state: () => ({
    tosConfig: {},
  }),
  actions: {
    setTosConfig(config) {
      this.tosConfig = config
    }
  }
})

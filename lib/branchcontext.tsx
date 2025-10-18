"use client"

import { createContext, useContext } from "react"

export interface Branch {
  id: string
  name: string
  address: string
  shop_id: string
}

export interface BranchContextType {
  selectedBranch: Branch | null
  branchChangeTrigger: number
  allBranches: Branch[]
}

export const BranchContext = createContext<BranchContextType | undefined>(undefined)

export const useBranch = () => {
  const context = useContext(BranchContext)
  if (context === undefined) {
    throw new Error('useBranch must be used within a DashboardLayout')
  }
  return context
}
"use client"

import { createContext, useContext, useState } from "react"

export interface Branch {
  id: string
  name: string
  address: string
  shop_id: string
  latitude?: number | null
  longitude?: number | null
  is_active?: boolean
}

export interface BranchContextType {
  selectedBranch: Branch | null
  branchChangeTrigger: number
  allBranches: Branch[]
  setSelectedBranch: (branch: Branch | null) => void
  refreshBranches: () => Promise<void>
  addBranch: (branch: Branch) => void
  updateBranches: (branches: Branch[]) => void
  updateBranch: (branchId: string, updates: Partial<Branch>) => Promise<void>
  deleteBranch: (branchId: string) => Promise<void>
}

export const BranchContext = createContext<BranchContextType | undefined>(undefined)

export const useBranch = () => {
  const context = useContext(BranchContext)
  if (context === undefined) {
    throw new Error('useBranch must be used within a DashboardLayout')
  }
  return context
}

// Provider component (you'll need to add this to your DashboardLayout)
export function BranchProvider({ 
  children, 
  initialBranches = [],
  initialSelectedBranch = null 
}: { 
  children: React.ReactNode
  initialBranches?: Branch[]
  initialSelectedBranch?: Branch | null
}) {
  const [allBranches, setAllBranches] = useState<Branch[]>(initialBranches)
  const [selectedBranch, setSelectedBranch] = useState<Branch | null>(initialSelectedBranch)
  const [branchChangeTrigger, setBranchChangeTrigger] = useState(0)

  const refreshBranches = async () => {
    try {
      // Fetch updated branches from API
      const response = await fetch('/api/owner/branches')
      if (response.ok) {
        const { branches } = await response.json()
        setAllBranches(branches || [])
        
        // If the currently selected branch still exists, keep it selected
        if (selectedBranch) {
          const updatedSelectedBranch = branches.find((b: Branch) => b.id === selectedBranch.id)
          setSelectedBranch(updatedSelectedBranch || branches[0] || null)
        } else if (branches.length > 0) {
          setSelectedBranch(branches[0])
        }
        
        setBranchChangeTrigger(prev => prev + 1)
      }
    } catch (error) {
      console.error('Error refreshing branches:', error)
    }
  }

  const addBranch = (branch: Branch) => {
    setAllBranches(prev => [...prev, branch])
    // Optionally auto-select the new branch
    // setSelectedBranch(branch)
    setBranchChangeTrigger(prev => prev + 1)
  }

  const updateBranches = (branches: Branch[]) => {
    setAllBranches(branches)
    setBranchChangeTrigger(prev => prev + 1)
  }

  const updateBranch = async (branchId: string, updates: Partial<Branch>) => {
    try {
      const response = await fetch('/api/owner/branches', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: branchId, ...updates })
      })

      if (!response.ok) {
        const { error } = await response.json()
        throw new Error(error || 'Failed to update branch')
      }

      const { branch: updatedBranch } = await response.json()
      
      // Update in local state
      setAllBranches(prev => 
        prev.map(branch => branch.id === branchId ? { ...branch, ...updatedBranch } : branch)
      )
      
      // If the updated branch is currently selected, update it too
      if (selectedBranch?.id === branchId) {
        setSelectedBranch(prev => prev ? { ...prev, ...updatedBranch } : null)
      }
      
      setBranchChangeTrigger(prev => prev + 1)
    } catch (error) {
      console.error('Error updating branch:', error)
      throw error
    }
  }

  const deleteBranch = async (branchId: string) => {
    try {
      const response = await fetch(`/api/owner/branches?id=${branchId}`, {
        method: 'DELETE'
      })

      if (!response.ok) {
        const { error } = await response.json()
        throw new Error(error || 'Failed to delete branch')
      }

      // Remove from local state
      setAllBranches(prev => prev.filter(branch => branch.id !== branchId))
      
      // If the deleted branch was selected, select another one
      if (selectedBranch?.id === branchId) {
        const remainingBranches = allBranches.filter(branch => branch.id !== branchId)
        setSelectedBranch(remainingBranches[0] || null)
      }
      
      setBranchChangeTrigger(prev => prev + 1)
    } catch (error) {
      console.error('Error deleting branch:', error)
      throw error
    }
  }

  return (
    <BranchContext.Provider value={{
      selectedBranch,
      branchChangeTrigger,
      allBranches,
      setSelectedBranch,
      refreshBranches,
      addBranch,
      updateBranches,
      updateBranch,
      deleteBranch
    }}>
      {children}
    </BranchContext.Provider>
  )
}
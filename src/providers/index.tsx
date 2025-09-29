import React from 'react'

import { HeaderThemeProvider } from './HeaderTheme'
import { ThemeProvider } from './Theme'
import { UserProvider } from '@/context/UserContext'
import { RevenueCatProvider } from './RevenueCat'

export const Providers: React.FC<{
  children: React.ReactNode
}> = ({ children }) => {
  return (
    <ThemeProvider>
      <HeaderThemeProvider>
        <UserProvider>
          <RevenueCatProvider>
            {children}
          </RevenueCatProvider>
        </UserProvider>
      </HeaderThemeProvider>
    </ThemeProvider>
  )
}

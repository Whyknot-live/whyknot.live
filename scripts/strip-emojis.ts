#!/usr/bin/env tsx

/**
 * Script to strip emojis from codebase
 * 
 * This script finds and removes visual emojis from TypeScript, JavaScript,
 * Markdown, and Astro files throughout the codebase.
 * 
 * Usage:
 *   bun run scripts/strip-emojis.ts [--dry-run]
 *   
 * Options:
 *   --dry-run    Show what would be changed without making changes
 */

import { readFileSync, writeFileSync, readdirSync, statSync } from 'fs'
import { join, relative } from 'path'

// Only target actual visual emojis that appear in code/comments
const VISUAL_EMOJIS: Record<string, string> = {
  '✓': '[check]',
  '✗': '[x]',
  '✅': '[success]',
  '❌': '[error]',
  '⚠️': '[warning]',
  '⚠': '[warning]',
  '🚀': '',
  '📝': '',
  '💡': '',
  '🔧': '',
  '🎉': '',
  '✨': '',
  '⭐': '',
  '💻': '',
  '🔒': '',
  '🔓': '',
  '📦': '',
  '🐛': '',
  '🔥': '',
  '💥': '',
  '⚡': '',
  '🌟': '',
  '📊': '',
  '📈': '',
  '🎯': '',
  '🏆': '',
  '❤️': '',
  '❤': '',
}

interface FileChange {
  path: string
  emojisRemoved: number
}

const changes: FileChange[] = []
const dryRun = process.argv.includes('--dry-run')

// File extensions to process
const EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx', '.md', '.astro']

// Directories to skip
const SKIP_DIRS = [
  'node_modules',
  'dist',
  'build',
  '.git',
  '.astro',
  '.vercel',
  '.netlify',
  'coverage',
  '.next',
  '.nuxt',
]

// Files to skip
const SKIP_FILES = [
  'package-lock.json',
  'bun.lockb',
  'yarn.lock',
  'pnpm-lock.yaml'
]

function shouldProcessFile(filePath: string): boolean {
  const fileName = filePath.substring(filePath.lastIndexOf('/') + 1)
  if (SKIP_FILES.includes(fileName)) return false
  
  const ext = filePath.substring(filePath.lastIndexOf('.'))
  return EXTENSIONS.includes(ext)
}

function shouldSkipDir(dirName: string): boolean {
  return SKIP_DIRS.includes(dirName) || dirName.startsWith('.')
}

function stripEmojis(content: string): { cleaned: string; count: number } {
  let count = 0
  let cleaned = content
  
  // Replace only the visual emojis we've explicitly listed
  for (const [emoji, replacement] of Object.entries(VISUAL_EMOJIS)) {
    // Escape special regex characters
    const escapedEmoji = emoji.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const regex = new RegExp(escapedEmoji, 'g')
    const occurrences = (cleaned.match(regex) || []).length
    
    if (occurrences > 0) {
      cleaned = cleaned.replace(regex, replacement)
      count += occurrences
    }
  }
  
  // Clean up any double spaces created by emoji removal
  cleaned = cleaned.replace(/  +/g, ' ')
  // Clean up space before punctuation
  cleaned = cleaned.replace(/ ([,.])/g, '$1')
  
  return { cleaned, count }
}

function processFile(filePath: string): void {
  try {
    const content = readFileSync(filePath, 'utf-8')
    const { cleaned, count } = stripEmojis(content)
    
    if (count > 0) {
      changes.push({
        path: filePath,
        emojisRemoved: count,
      })
      
      if (!dryRun) {
        writeFileSync(filePath, cleaned, 'utf-8')
      }
    }
  } catch (error) {
    console.error(`Error processing ${filePath}:`, error)
  }
}

function walkDirectory(dir: string): void {
  try {
    const entries = readdirSync(dir)
    
    for (const entry of entries) {
      const fullPath = join(dir, entry)
      const stat = statSync(fullPath)
      
      if (stat.isDirectory()) {
        if (!shouldSkipDir(entry)) {
          walkDirectory(fullPath)
        }
      } else if (stat.isFile() && shouldProcessFile(fullPath)) {
        processFile(fullPath)
      }
    }
  } catch (error) {
    console.error(`Error walking directory ${dir}:`, error)
  }
}

// Main execution
const rootDir = join(process.cwd())
console.log(`\nEmoji Stripper ${dryRun ? '(DRY RUN)' : ''}\n`)
console.log(`Scanning: ${rootDir}\n`)

walkDirectory(rootDir)

// Print results
if (changes.length === 0) {
  console.log('No emojis found in codebase.')
} else {
  console.log(`\nFound emojis in ${changes.length} file(s):\n`)
  
  const maxPathLength = Math.max(...changes.map(c => relative(rootDir, c.path).length), 30)
  
  for (const change of changes) {
    const relPath = relative(rootDir, change.path)
    console.log(`  ${relPath.padEnd(maxPathLength)}  ${change.emojisRemoved} emoji(s)`)
  }
  
  const totalEmojis = changes.reduce((sum, c) => sum + c.emojisRemoved, 0)
  
  console.log(`\nTotal: ${totalEmojis} emoji(s) in ${changes.length} file(s)`)
  
  if (dryRun) {
    console.log('\nRun without --dry-run to apply changes')
  } else {
    console.log('\nChanges applied successfully!')
  }
}

console.log()

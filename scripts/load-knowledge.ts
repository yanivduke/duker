#!/usr/bin/env tsx

/**
 * Knowledge Base Loader Script
 * Loads Vue3/Vuetify3 and coding knowledge into ChromaDB
 */

import { KnowledgeLoader } from '../src/utils/knowledge-loader.js'
import chalk from 'chalk'

async function main() {
  console.log(chalk.blue.bold('\n🚀 Duker Knowledge Base Loader\n'))

  const loader = new KnowledgeLoader()

  // Check ChromaDB availability
  console.log(chalk.cyan('Checking ChromaDB connection...'))
  const status = await loader.getStatus()

  if (!status.available) {
    console.log(chalk.red('❌ ChromaDB is not available'))
    console.log(chalk.yellow('\nPlease start ChromaDB first:'))
    console.log(chalk.white('  chroma run --host localhost --port 8000'))
    console.log(chalk.white('  or'))
    console.log(chalk.white('  docker run -p 8000:8000 chromadb/chroma\n'))
    process.exit(1)
  }

  console.log(chalk.green('✓ ChromaDB is running\n'))

  // Load all knowledge
  console.log(chalk.cyan('Loading knowledge bases...'))

  const result = await loader.loadAll()

  if (result.success) {
    console.log(chalk.green(`\n✓ Successfully loaded ${result.collections.length} collections:\n`))
    result.collections.forEach((collection) => {
      console.log(chalk.white(`  - ${collection}`))
    })

    // Show status
    const finalStatus = await loader.getStatus()
    console.log(chalk.cyan('\nKnowledge Base Status:'))
    finalStatus.collections.forEach((col) => {
      console.log(chalk.white(`  ${col.name}: ${col.count} documents`))
    })

    console.log(chalk.green('\n✓ Knowledge base ready!\n'))
  } else {
    console.log(chalk.red(`\n❌ Failed to load knowledge: ${result.error}\n`))
    process.exit(1)
  }
}

main().catch((error) => {
  console.error(chalk.red('\n❌ Error:'), error.message)
  process.exit(1)
})

<template>
  <nav class="w-full border-b border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
    <div class="flex w-full">
      <RouterLink
        to="/bets"
        class="flex-1 px-4 py-3 text-center text-sm font-medium border-b-2 transition"
        :class="
          $route.path === '/bets'
            ? 'border-blue-600 text-blue-600 dark:text-blue-400'
            : 'border-transparent text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white'
        "
      >
        Bets
      </RouterLink>
      <RouterLink
        to="/overall-stats"
        class="flex-1 px-4 py-3 text-center text-sm font-medium border-b-2 transition"
        :class="
          $route.path === '/overall-stats'
            ? 'border-blue-600 text-blue-600 dark:text-blue-400'
            : 'border-transparent text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white'
        "
      >
        Overall Stats
      </RouterLink>
    </div>
  </nav>
</template>

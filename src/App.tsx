import { useCallback } from 'react'
import {
  QueryClient,
  QueryClientProvider,
  useMutation,
  useQuery,
} from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import axios from 'axios'

// --- 1. Бизнес логика
// 
// Писать логику внутри компонентов/хуков и не очень правильно и в целом
// такое себе удовольствие, учитывая, что они вызываются по много раз,
// а эффекты стреляют по два раза. )
// Поэтому хуки только для связки UI и бизнес логики, последняя пишется
// отдельно и про UI ничего не знает.
// При желании можно будет потом выкинуть Реакт и взять другой UI фреймворк.

interface RepoData {
  name: string
  description: string
  subscribers_count: string
  stargazers_count: string
  forks_count: string
}

class MyService {
  // Пример периодически обновляющейся переменной. Если подписчиков много - можно взять
  // EventTarget или его аналог, или любую реактивную обертку.
  counter = 1
  onDidUpdateCounter?: (() => void)

  intervalHandle?: ReturnType<typeof setInterval>

  startUpdating = (): void => {
    this.stopUpdating()
    this.intervalHandle = setInterval(() => {
      ++this.counter;
      this.onDidUpdateCounter?.()
    }, 3000)
  }

  stopUpdating = (): void => {
    if (this.intervalHandle !== undefined) {
      clearInterval(this.intervalHandle)
      this.intervalHandle = undefined
    }
  }

  // Пример асинхронного запроса
  fetchRepoData = async (): Promise<RepoData> => {
    const res = await axios.get('https://api.github.com/repos/tannerlinsley/react-query')
    return res.data
  }
}

// --- 2. UI

// Пропускаем весь дата фетчинг и модификации через React-query (queries & mutations), кешируем
// данные по нужным стратегиям, он заодно воркараундит двойные вызовы useEffect-а.

const queryClient = new QueryClient()

// Сервисы не обязательно создавать глобально, можно сгруппировать и раздать через контекст.
// Можно сделать две реализации сервисов: мок для превью + настоящую.
const myService = new MyService()
myService.onDidUpdateCounter = () => {
  // Если тут сразу приходят данные в параметрах, то можно
  // вместо invalidateQueries прямо вставить их в кеш react-query.
  queryClient.invalidateQueries({ queryKey: ["counter"] })
}
myService.startUpdating()

// Компоненты

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Example />
    </QueryClientProvider>
  )
}

// все useEffect, useQuery, blablabla заворачиваем в удобные однострочные хуки

function useRepoData() {
  const { isPending, isLoading, error, data, isFetching } = useQuery({
    queryKey: ['repoData'],
    queryFn: async () => {
      // Make it slower to see how it works
      await new Promise(resolve => setTimeout(resolve, 1000));
      return await myService.fetchRepoData()
    }
  })
  return { isPending, isLoading, error, data, isFetching }
}

function useRepoDataMutation() {
  return useMutation({
    mutationFn: async () => {
      // mutate repoData
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  })
}

function useCounter() {
  const { data: counter } = useQuery({
    queryKey: ['counter'],
    queryFn: () => myService.counter
  })
  return { counter }
}

function Example() {
  const { isPending, isLoading, isFetching, error, data } = useRepoData()
  const { mutate, isPending: isMutationPending } = useRepoDataMutation()
  const { counter } = useCounter()
  
  const handleClick = useCallback(() => {
    mutate(undefined, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["repoData"] })
      }
    })
  }, [mutate])

  if (isPending || !data) return 'Pending...'
  if (isLoading || !data) return 'Loading...'
  if (isFetching || !data) return 'Fetching...'
  if (isMutationPending || !data) return 'Mutating...'

  if (error) return 'An error has occurred: ' + error.message

  return (
    <div>
      <h1>{data.name}</h1>
      <p>Counter: {counter}</p>
      <button onClick={handleClick}>Mutate repoData</button>
      <p>{data.description}</p>
      <strong>👀 {data.subscribers_count}</strong>{' '}
      <strong>✨ {data.stargazers_count}</strong>{' '}
      <strong>🍴 {data.forks_count}</strong>
      <ReactQueryDevtools initialIsOpen />
    </div>
  )
}


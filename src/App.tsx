import {
  QueryClient,
  QueryClientProvider,
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
  const { isPending, error, data, isFetching } = useQuery({
    queryKey: ['repoData'],
    queryFn: async () => await myService.fetchRepoData()
  })
  return { isPending, error, data, isFetching }
}

function useCounter() {
  const { data: counter } = useQuery({
    queryKey: ['counter'],
    queryFn: () => myService.counter
  })
  return { counter }
}

function Example() {
  const { isPending, error, data, isFetching } = useRepoData()
  const { counter } = useCounter()

  if (isPending || !data) return 'Loading...'

  if (error) return 'An error has occurred: ' + error.message

  return (
    <div>
      <h1>{data.name}</h1>
      <p>Counter: {counter}</p>
      <p>{data.description}</p>
      <strong>👀 {data.subscribers_count}</strong>{' '}
      <strong>✨ {data.stargazers_count}</strong>{' '}
      <strong>🍴 {data.forks_count}</strong>
      <div>{isFetching ? 'Updating...' : ''}</div>
      <ReactQueryDevtools initialIsOpen />
    </div>
  )
}


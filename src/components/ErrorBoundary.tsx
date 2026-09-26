import { Component, type ReactNode } from 'react'
import { useAppStore } from '../store/useAppStore'

interface Props {
  children: ReactNode
}

interface State {
  error: Error | null
}

/** 渲染兜底：任何页面抛错都不白屏，可一键回首页 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error) {
    console.error('[今天吃啥] 页面渲染异常：', error)
  }

  render() {
    if (this.state.error) {
      return (
        <div className="pt-20 text-center">
          <div className="text-5xl">😵</div>
          <h1 className="mt-3 font-display text-2xl">页面炸了</h1>
          <p className="mt-1 text-sm text-stone-500">锅是程序的，饭还是要吃的</p>
          <button
            type="button"
            onClick={() => {
              this.setState({ error: null })
              useAppStore.getState().goHome()
            }}
            className="btn-pop font-display mt-7 rounded-2xl bg-[var(--primary)] px-8 py-3 text-lg text-white"
          >
            🍚 回首页
          </button>
        </div>
      )
    }
    return this.props.children
  }
}

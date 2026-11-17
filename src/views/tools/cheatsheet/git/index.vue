<script setup lang="ts">
import ToolPage from '@/components/tools/ToolPage.vue'
import CheatSheet from '@/components/tools/CheatSheet.vue'

const sections = [
  {
    title: '初始化与提交',
    desc: '日常最常用',
    items: [
      { name: 'git init / clone', desc: '新建仓库或克隆远程', code: 'git init\ngit clone https://github.com/user/repo.git' },
      { name: 'git status -sb', desc: '短格式查看分支与改动', code: 'git status -sb' },
      { name: 'git add', desc: '-p 可分块暂存，只提交相关改动', code: 'git add .\ngit add -p src/views' },
      { name: 'git commit', desc: '-m 单行信息，-am 跳过 add（仅限已跟踪文件）', code: 'git commit -m "feat: 新增 JWT 解析工具"' },
      { name: 'git commit --amend', desc: '修补最后一次提交（未推送前使用）', code: 'git add .\ngit commit --amend --no-edit' },
      { name: 'git log', desc: '图形化查看历史', code: 'git log --oneline --graph --decorate -n 20' },
    ],
  },
  {
    title: '分支',
    desc: '创建 / 切换 / 合并',
    items: [
      { name: '查看与创建', desc: 'switch 比 checkout 语义更清晰', code: 'git branch -vv\ngit switch -c feature/jwt' },
      { name: '切换', desc: '回到上一个分支用 -', code: 'git switch main\ngit switch -' },
      { name: '合并', desc: '--no-ff 保留分支历史，便于回溯', code: 'git merge feature/jwt --no-ff' },
      { name: '删除分支', desc: '未合并分支需 -D 强制删除', code: 'git branch -d feature/jwt\ngit branch -D feature/jwt' },
      { name: '变基', desc: '让提交线更干净，已推送的分支不要 rebase', code: 'git rebase main\ngit rebase -i HEAD~3' },
      { name: 'cherry-pick', desc: '把指定提交摘到当前分支', code: 'git cherry-pick 9f2c1e' },
    ],
  },
  {
    title: '撤销与回滚',
    desc: '按影响范围选择',
    items: [
      { name: 'git restore', desc: '丢弃工作区改动（危险，不可恢复）', code: 'git restore src/main.ts\ngit restore --staged src/main.ts  # 取消暂存' },
      { name: 'git reset', desc: 'soft 保留改动 / mixed 默认 / hard 全部丢弃', code: 'git reset --soft HEAD~1\ngit reset --hard HEAD~1  # 危险' },
      { name: 'git revert', desc: '生成反向提交，已推送场景的安全做法', code: 'git revert 9f2c1e' },
      { name: 'git checkout -- file', desc: '旧写法，等价 restore', code: 'git checkout -- src/main.ts' },
      { name: 'reflog', desc: '误删分支或 reset 后的救命工具', code: 'git reflog\ngit reset --hard HEAD@{3}' },
    ],
  },
  {
    title: '远程协作',
    desc: 'fetch / pull / push',
    items: [
      { name: 'git remote', desc: '查看与修改远程地址', code: 'git remote -v\ngit remote set-url origin git@github.com:u/r.git' },
      { name: 'git fetch', desc: '只拉取不合并，最安全', code: 'git fetch --all --prune' },
      { name: 'git pull', desc: '默认 merge，可配置 rebase 保持线性', code: 'git pull --rebase origin main' },
      { name: 'git push', desc: '首次推送需设置上游分支', code: 'git push -u origin main' },
      { name: '强制推送', desc: '仅在个人分支且确认无他人使用时', code: 'git push --force-with-lease' },
      { name: '标签', desc: '发布版本打 tag', code: 'git tag -a v1.0.0 -m "release"\ngit push origin v1.0.0' },
    ],
  },
  {
    title: '暂存与工作区',
    desc: 'stash / worktree',
    items: [
      { name: 'git stash', desc: '临时保存改动，切换分支必备', code: 'git stash push -m "wip: 表格样式"\ngit stash list\ngit stash pop' },
      { name: '部分暂存', desc: '只藏某个文件或保留暂存区', code: 'git stash push -- src/views/gis\ngit stash push --keep-index' },
      { name: 'git worktree', desc: '同一仓库多目录并行开发，不必反复 stash', code: 'git worktree add ../hotfix main' },
      { name: 'git clean', desc: '删除未跟踪文件，-n 先预览', code: 'git clean -nd\ngit clean -fd' },
      { name: '子模块', desc: '克隆时记得初始化', code: 'git submodule update --init --recursive' },
    ],
  },
  {
    title: '排查与进阶',
    desc: '定位问题',
    items: [
      { name: 'git diff', desc: '对比工作区、暂存区与提交', code: 'git diff\ngit diff --staged\ngit diff main...feature' },
      { name: 'git blame', desc: '逐行追溯最后一次修改', code: 'git blame -L 10,30 src/main.ts' },
      { name: 'git bisect', desc: '二分定位引入 bug 的提交', code: 'git bisect start\ngit bisect bad\ngit bisect good v1.0.0' },
      { name: 'git grep', desc: '在版本库内容中搜索', code: 'git grep -n "TODO" HEAD' },
      { name: '清理引用', desc: '删除已合并的本地分支', code: 'git branch --merged main | xargs git branch -d' },
    ],
  },
]
</script>

<template>
  <ToolPage title="Git 速查" desc="提交、分支、撤销、远程协作与排查命令" wide>
    <CheatSheet :sections="sections" />
  </ToolPage>
</template>

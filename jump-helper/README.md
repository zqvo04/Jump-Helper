# Jump 도우미

팀 순번제 일일 담당자(Jump) 예측 웹앱 — React + Vite + Tailwind + Supabase

## 빠른 시작

### 1. Supabase 프로젝트 설정

Supabase 대시보드 → SQL 에디터에 아래 스키마 실행:

```sql
CREATE TABLE duty_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  date date NOT NULL UNIQUE,
  person text NOT NULL,
  is_holiday boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE duty_weights (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  version text NOT NULL,
  elapsed numeric NOT NULL DEFAULT 0.2757,
  fairness numeric NOT NULL DEFAULT 0.4135,
  recency numeric NOT NULL DEFAULT 0.2608,
  rot numeric NOT NULL DEFAULT 0.0500,
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE duty_ml_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  date date NOT NULL,
  actual_person text NOT NULL,
  is_holiday boolean NOT NULL,
  predicted_rank integer NOT NULL,
  predicted_prob numeric,
  top5 jsonb,
  weights_before jsonb,
  weights_after jsonb,
  delta jsonb,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE duty_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  is_active boolean NOT NULL DEFAULT true,
  is_retired boolean NOT NULL DEFAULT false,
  is_new boolean NOT NULL DEFAULT false,
  display_order integer,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE duty_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE duty_weights ENABLE ROW LEVEL SECURITY;
ALTER TABLE duty_ml_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE duty_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public_all" ON duty_history FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "public_all" ON duty_weights FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "public_all" ON duty_ml_log FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "public_all" ON duty_members FOR ALL USING (true) WITH CHECK (true);
```

### 2. 환경 변수 설정

`.env.local` 파일에 Supabase 정보 입력:
```
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
```

### 3. 로컬 개발 실행

```bash
npm install
npm run dev
```

### 4. Cloudflare Pages 배포

- Build command: `npm run build`
- Output directory: `dist`
- 환경 변수: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` 추가

---

## 앱 기능

| 탭 | 기능 |
|---|---|
| ✏️ 입력 | 날짜·담당자 입력, 예측 확률 미리보기, ML 가중치 즉시 업데이트 |
| 🎯 예측 | 내일/모레 Top5 예측 + 신뢰도 배너 + ROT 순번 참고 |
| 👥 멤버 | 신규 추가, 활성/비활성, 퇴직 처리 |
| 📊 분석 | Top1/3/5 정확도, 스파크라인, 가중치 변화 차트 및 이력 |
| 📈 통계 | 멤버별 횟수, 월별 히트맵, 전체 이력 검색 |
| 📅 경과일 | 멤버별 평일·휴일 경과일 (색상 코딩) |

## ML 알고리즘

4개 피처 + 온라인 가중치 업데이트:

| 피처 | 초기 가중치 | 설명 |
|---|---|---|
| elapsed | 0.2757 | 마지막 근무 이후 경과일 (타입 무관) |
| fairness | 0.4135 | 기대 배정 횟수 대비 실제 부족분 |
| recency | 0.2608 | 최근 21일 배정 밀도 역수 |
| rot | 0.0500 | ROT 순번 거리 + 교환 패턴 보너스 |

매일 실제 담당자를 입력하면 Softmax 예측 오차 기반으로 가중치가 자동 조정됩니다.

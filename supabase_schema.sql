-- Veritas Academy Relational Database Migration Plan
-- Establishes fully query-optimized structural containers for students registry and transactions ledger with Row-Level Security enabled.

-- Drop existing tables if they exist to avoid conflict and keep database pristine
DROP TABLE IF EXISTS public.transactions CASCADE;
DROP TABLE IF EXISTS public.students CASCADE;

-- 1. Create Students Table
CREATE TABLE public.students (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    phone TEXT NOT NULL,
    address TEXT,
    grade TEXT NOT NULL,
    outstanding_balance NUMERIC NOT NULL DEFAULT 0 CHECK (outstanding_balance >= 0),
    sync_method TEXT NOT NULL DEFAULT 'cloud',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- 2. Create Transactions Table
CREATE TABLE public.transactions (
    id TEXT PRIMARY KEY,
    student_id TEXT REFERENCES public.students(id) ON DELETE CASCADE NOT NULL,
    amount NUMERIC NOT NULL CHECK (amount > 0),
    reference TEXT UNIQUE NOT NULL,
    timestamp TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- 3. Row-Level Security (RLS) activation
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

-- Permissive anonymous client-side portal access policies (for sandbox/demo purposes)
CREATE POLICY "Enable public read for student lookup" 
    ON public.students 
    FOR SELECT 
    USING (true);

CREATE POLICY "Enable public insert for admission application" 
    ON public.students 
    FOR INSERT 
    WITH CHECK (true);

CREATE POLICY "Enable public update for balance deduction" 
    ON public.students 
    FOR UPDATE 
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Enable public read for ledger tracking" 
    ON public.transactions 
    FOR SELECT 
    USING (true);

CREATE POLICY "Enable public insert for transaction receipt log" 
    ON public.transactions 
    FOR INSERT 
    WITH CHECK (true);

-- 4. Speed optimization indexes for high transactional performance
CREATE INDEX idx_students_id ON public.students (id);
CREATE INDEX idx_students_name ON public.students (name);
CREATE INDEX idx_transactions_student_id ON public.transactions (student_id);
CREATE INDEX idx_transactions_reference ON public.transactions (reference);
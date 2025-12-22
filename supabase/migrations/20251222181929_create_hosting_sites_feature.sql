/*
  # Hosting Sites Feature
  
  Standalone feature for mapping hosting plans to multiple websites/domains.
  This is completely independent of existing tables and features.
  
  1. New Tables
    - `hosting_plans`
      - `id` (uuid, primary key)
      - `user_id` (uuid, foreign key to auth.users)
      - `name` (text, hosting plan name)
      - `created_at` (timestamptz)
    
    - `hosted_websites`
      - `id` (uuid, primary key)
      - `hosting_plan_id` (uuid, foreign key to hosting_plans)
      - `domain_name` (text, website/domain name)
      - `created_at` (timestamptz)
  
  2. Security
    - Enable RLS on both tables
    - Users can only access their own hosting plans
    - Users can only access websites under their hosting plans
*/

-- Create hosting_plans table
CREATE TABLE IF NOT EXISTS hosting_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users NOT NULL,
  name text NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL
);

-- Create hosted_websites table
CREATE TABLE IF NOT EXISTS hosted_websites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hosting_plan_id uuid REFERENCES hosting_plans ON DELETE CASCADE NOT NULL,
  domain_name text NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL
);

-- Enable RLS
ALTER TABLE hosting_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE hosted_websites ENABLE ROW LEVEL SECURITY;

-- Policies for hosting_plans
CREATE POLICY "Users can view own hosting plans"
  ON hosting_plans FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own hosting plans"
  ON hosting_plans FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own hosting plans"
  ON hosting_plans FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own hosting plans"
  ON hosting_plans FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Policies for hosted_websites
CREATE POLICY "Users can view websites under their hosting plans"
  ON hosted_websites FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM hosting_plans
      WHERE hosting_plans.id = hosted_websites.hosting_plan_id
      AND hosting_plans.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert websites under their hosting plans"
  ON hosted_websites FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM hosting_plans
      WHERE hosting_plans.id = hosted_websites.hosting_plan_id
      AND hosting_plans.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update websites under their hosting plans"
  ON hosted_websites FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM hosting_plans
      WHERE hosting_plans.id = hosted_websites.hosting_plan_id
      AND hosting_plans.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM hosting_plans
      WHERE hosting_plans.id = hosted_websites.hosting_plan_id
      AND hosting_plans.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete websites under their hosting plans"
  ON hosted_websites FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM hosting_plans
      WHERE hosting_plans.id = hosted_websites.hosting_plan_id
      AND hosting_plans.user_id = auth.uid()
    )
  );
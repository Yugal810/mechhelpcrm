-- Update Policies (Allow all access for everyone, including anon)
DROP POLICY IF EXISTS "Auth users can full access profiles" ON profiles;
DROP POLICY IF EXISTS "Auth users can full access garages" ON garages;
DROP POLICY IF EXISTS "Auth users can full access car_brands" ON car_brands;
DROP POLICY IF EXISTS "Auth users can full access car_models" ON car_models;
DROP POLICY IF EXISTS "Auth users can full access leads" ON leads;
DROP POLICY IF EXISTS "Auth users can full access booking_history" ON booking_history;
DROP POLICY IF EXISTS "Auth users can full access activity_history" ON activity_history;
DROP POLICY IF EXISTS "Auth users can full access call_list_items" ON call_list_items;

CREATE POLICY "Allow all access to profiles" ON profiles FOR ALL USING (true);
CREATE POLICY "Allow all access to garages" ON garages FOR ALL USING (true);
CREATE POLICY "Allow all access to car_brands" ON car_brands FOR ALL USING (true);
CREATE POLICY "Allow all access to car_models" ON car_models FOR ALL USING (true);
CREATE POLICY "Allow all access to leads" ON leads FOR ALL USING (true);
CREATE POLICY "Allow all access to booking_history" ON booking_history FOR ALL USING (true);
CREATE POLICY "Allow all access to activity_history" ON activity_history FOR ALL USING (true);
CREATE POLICY "Allow all access to call_list_items" ON call_list_items FOR ALL USING (true);

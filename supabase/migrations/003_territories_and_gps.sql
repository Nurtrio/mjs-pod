-- Driver territories for AI auto-dispatch
CREATE TABLE driver_territories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id UUID REFERENCES drivers(id) ON DELETE CASCADE,
  territory_name TEXT NOT NULL,
  description TEXT NOT NULL,
  zip_codes TEXT[] DEFAULT '{}',
  priority INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Live GPS tracking (upsert pattern — one row per driver)
CREATE TABLE driver_locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id UUID REFERENCES drivers(id) ON DELETE CASCADE UNIQUE,
  lat DECIMAL NOT NULL,
  lng DECIMAL NOT NULL,
  heading DECIMAL,
  speed DECIMAL,
  accuracy DECIMAL,
  recorded_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX idx_driver_territories_driver ON driver_territories(driver_id);
CREATE INDEX idx_driver_locations_driver ON driver_locations(driver_id);

-- Enable Realtime on driver_locations
ALTER TABLE driver_locations REPLICA IDENTITY FULL;

-- RLS (open for internal app)
ALTER TABLE driver_territories ENABLE ROW LEVEL SECURITY;
ALTER TABLE driver_locations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all on driver_territories" ON driver_territories FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on driver_locations" ON driver_locations FOR ALL USING (true) WITH CHECK (true);

-- Seed territories
-- Erik: Inland Empire + Orange County
INSERT INTO driver_territories (driver_id, territory_name, description, zip_codes, priority)
SELECT id, 'Inland Empire + Orange County',
  'Erik covers the Inland Empire (Riverside, San Bernardino, Corona, Ontario, Rancho Cucamonga, Fontana, Moreno Valley, Redlands, Temecula, Murrieta, etc.) and Orange County south of the 91 (Irvine, Santa Ana, Costa Mesa, Huntington Beach, Newport Beach, Mission Viejo, Lake Forest, Laguna, Tustin, Orange, Garden Grove, Westminster, Fountain Valley, Dana Point, San Clemente, etc.). Basically anything east on the 91 toward Riverside/IE or south into OC.',
  ARRAY[
    '91701','91702','91709','91710','91730','91739','91761','91762','91763','91764','91784','91786',
    '92501','92502','92503','92504','92505','92506','92507','92508','92509','92530','92532','92536',
    '92543','92544','92545','92551','92553','92555','92557','92562','92563','92567','92570','92571',
    '92582','92583','92584','92585','92586','92587','92590','92591','92592','92595','92596',
    '92860','92879','92880','92881','92882','92883',
    '92602','92603','92604','92606','92610','92612','92614','92617','92618','92620',
    '92624','92625','92626','92627','92629','92630','92637','92646','92647','92648','92649',
    '92651','92653','92655','92656','92657','92660','92661','92663','92672','92673','92675','92676','92677','92679',
    '92688','92691','92692','92694',
    '92701','92703','92704','92705','92706','92707','92708',
    '92780','92782',
    '92840','92841','92843','92844','92845',
    '92861','92862','92863','92864','92865','92866','92867','92868','92869'
  ],
  1
FROM drivers WHERE name = 'Erik';

-- Jose: Anaheim corridor -> 91 Fwy -> 5 Fwy -> LA
INSERT INTO driver_territories (driver_id, territory_name, description, zip_codes, priority)
SELECT id, 'Anaheim to LA Corridor',
  'Jose covers Anaheim and everything heading toward Los Angeles along the 91 Freeway and 5 Freeway corridor. This includes: Anaheim, Fullerton, Buena Park, La Palma, Cypress, Cerritos, Norwalk, Downey, Whittier, La Mirada, Santa Fe Springs, Commerce, Vernon, East LA, Downtown LA, Montebello, Pico Rivera, Bell, Bell Gardens, Paramount, Compton, Lakewood, Long Beach, and surrounding areas along this corridor. Home base is 3066 E La Palma Ave, Anaheim, CA 92806.',
  ARRAY[
    '92801','92802','92804','92805','92806','92807','92808',
    '92821','92831','92832','92833','92835',
    '92870',
    '90620','90621','90623','90630','90631','90632',
    '90638','90639','90640','90650','90660','90670',
    '90601','90602','90603','90604','90605','90606',
    '90701','90703','90706','90712','90713','90715','90716','90723','90746',
    '90805','90806','90807','90808','90810','90813','90814','90815',
    '91706',
    '90001','90002','90003','90011','90012','90013','90014','90015','90017','90021','90022','90023',
    '90040','90058','90063',
    '90201','90220','90240','90241','90242','90255','90270','90280',
    '90501','90502','90503','90504','90505',
    '90731','90732','90744','90745','90748'
  ],
  2
FROM drivers WHERE name = 'Jose';

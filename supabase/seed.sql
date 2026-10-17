SET session_replication_role = replica;

--
-- PostgreSQL database dump
--

-- \restrict LL9rmsdugpO8JRAXitk9nc2BUBL4KHcdJSNnd6k4ZxqMAF9QkcfHPmt2aycXZwu

-- Dumped from database version 17.11
-- Dumped by pg_dump version 17.11

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Data for Name: comercios; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."comercios" ("id", "nombre", "slug", "activo", "creado_en") VALUES
	('4edf1fa0-f8a4-49cf-b72f-d1f4464de4e5', 'Piamonte', 'piamonte', true, '2026-10-07 23:31:27.804472+00');


--
-- Data for Name: categorias; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."categorias" ("id", "comercio_id", "nombre", "slug", "descripcion", "imagen_url", "orden", "activa", "creado_en") VALUES
	('4d09d361-5b34-4c6b-8f2d-92caf21241fa', '4edf1fa0-f8a4-49cf-b72f-d1f4464de4e5', 'Promos', 'promos', NULL, NULL, 2, true, '2026-10-07 23:34:31.319706+00'),
	('582af425-324b-4fe9-87ec-a279cc2b5b9b', '4edf1fa0-f8a4-49cf-b72f-d1f4464de4e5', 'Pizzería', 'pizzeria', NULL, NULL, 3, true, '2026-10-07 23:34:31.319706+00'),
	('971dac73-8489-4288-86a5-b1164318c0f4', '4edf1fa0-f8a4-49cf-b72f-d1f4464de4e5', 'Pizzetas', 'pizzetas', NULL, NULL, 4, true, '2026-10-07 23:34:31.319706+00'),
	('65b58ccd-4f41-4d25-86d2-2f9f3b035b73', '4edf1fa0-f8a4-49cf-b72f-d1f4464de4e5', 'Calzone', 'calzone', NULL, NULL, 5, true, '2026-10-07 23:34:31.319706+00'),
	('96a8981f-a2b4-45bf-8651-b357c716f32f', '4edf1fa0-f8a4-49cf-b72f-d1f4464de4e5', 'Especiales', 'especiales', NULL, NULL, 6, true, '2026-10-07 23:34:31.319706+00'),
	('80db5624-7f71-49ac-b141-b8e81df50803', '4edf1fa0-f8a4-49cf-b72f-d1f4464de4e5', 'Smash Burger', 'smash-burger', NULL, NULL, 7, true, '2026-10-07 23:34:31.319706+00'),
	('4d3091e0-d119-4f80-b484-7a3642e39e7d', '4edf1fa0-f8a4-49cf-b72f-d1f4464de4e5', 'Chivitos', 'chivitos', NULL, NULL, 8, true, '2026-10-07 23:34:31.319706+00'),
	('7399a0c2-66ec-4114-b181-49884129b5e9', '4edf1fa0-f8a4-49cf-b72f-d1f4464de4e5', 'Porciones', 'porciones', NULL, NULL, 9, true, '2026-10-07 23:34:31.319706+00'),
	('1da3d900-94ab-4945-9d65-4be6687a1d13', '4edf1fa0-f8a4-49cf-b72f-d1f4464de4e5', 'Fritas salseadas', 'fritas-salseadas', NULL, NULL, 10, true, '2026-10-07 23:34:31.319706+00'),
	('53430e50-f5de-4b87-a880-9df2adc1a174', '4edf1fa0-f8a4-49cf-b72f-d1f4464de4e5', 'Tostados', 'tostados', NULL, NULL, 11, true, '2026-10-07 23:34:31.319706+00'),
	('6e70e6ed-c8b8-400c-9ec6-f3064de9279a', '4edf1fa0-f8a4-49cf-b72f-d1f4464de4e5', 'Milanesas Gourmet', 'milanesas-gourmet', NULL, NULL, 12, true, '2026-10-07 23:34:31.319706+00'),
	('a9920984-bde9-41ff-9bdd-904108ac2366', '4edf1fa0-f8a4-49cf-b72f-d1f4464de4e5', 'Milanesas', 'milanesas', NULL, NULL, 13, true, '2026-10-07 23:34:31.319706+00'),
	('f7626245-9fef-429f-8e30-c185015c0af3', '4edf1fa0-f8a4-49cf-b72f-d1f4464de4e5', 'Picadas', 'picadas', NULL, NULL, 14, true, '2026-10-07 23:34:31.319706+00'),
	('91b95b20-6473-4dbb-9940-4f242f3d7c23', '4edf1fa0-f8a4-49cf-b72f-d1f4464de4e5', 'Bebidas', 'bebidas', NULL, NULL, 15, true, '2026-10-07 23:34:31.319706+00'),
	('b5099b57-2b13-4ba4-8a5a-568373836f87', '4edf1fa0-f8a4-49cf-b72f-d1f4464de4e5', 'Nuevos Productos', 'nuevos', NULL, NULL, 1, false, '2026-10-07 23:34:31.319706+00'),
	('ac1c0b36-529f-4710-a879-b141c08ebd86', '4edf1fa0-f8a4-49cf-b72f-d1f4464de4e5', 'prueba1', 'prueba1', 'ninguna', NULL, 16, false, '2026-10-10 06:08:39.739854+00');


--
-- Data for Name: productos; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."productos" ("id", "comercio_id", "categoria_id", "nombre", "descripcion", "imagen_url", "tipo", "precio_base", "disponible", "destacado", "orden", "creado_en", "activo") VALUES
	('6d270348-80b2-4f9b-8810-d23100280817', '4edf1fa0-f8a4-49cf-b72f-d1f4464de4e5', '582af425-324b-4fe9-87ec-a279cc2b5b9b', '½ metro de pizza', NULL, NULL, 'simple', 300.00, true, false, 10, '2026-10-07 23:45:49.168144+00', true),
	('a709787a-c19f-49eb-a5c5-43552984f233', '4edf1fa0-f8a4-49cf-b72f-d1f4464de4e5', '582af425-324b-4fe9-87ec-a279cc2b5b9b', '½ metro de muzza', NULL, NULL, 'simple', 480.00, true, false, 9, '2026-10-07 23:45:49.168144+00', true),
	('934106f8-6ec9-4a3e-b164-e9c2767c02d1', '4edf1fa0-f8a4-49cf-b72f-d1f4464de4e5', '582af425-324b-4fe9-87ec-a279cc2b5b9b', 'Fainá encebollado', NULL, NULL, 'simple', 180.00, true, false, 6, '2026-10-07 23:45:49.168144+00', true),
	('ab7afabe-c5ef-4125-bc6d-0838f0fb51c7', '4edf1fa0-f8a4-49cf-b72f-d1f4464de4e5', '582af425-324b-4fe9-87ec-a279cc2b5b9b', 'Metro de muzza', NULL, NULL, 'simple', 820.00, true, false, 11, '2026-10-07 23:45:49.168144+00', true),
	('450561f9-5e7d-4617-a8f0-3028b14571a6', '4edf1fa0-f8a4-49cf-b72f-d1f4464de4e5', '582af425-324b-4fe9-87ec-a279cc2b5b9b', 'Figazza con muzza', NULL, NULL, 'simple', 260.00, true, false, 4, '2026-10-07 23:45:49.168144+00', true),
	('a66fe995-3c28-4551-9afb-a337ad29e8f8', '4edf1fa0-f8a4-49cf-b72f-d1f4464de4e5', '582af425-324b-4fe9-87ec-a279cc2b5b9b', 'Figazza', NULL, NULL, 'simple', 220.00, true, false, 3, '2026-10-07 23:45:49.168144+00', true),
	('8b4e8018-210a-4688-b18a-8c6855f07c4d', '4edf1fa0-f8a4-49cf-b72f-d1f4464de4e5', '582af425-324b-4fe9-87ec-a279cc2b5b9b', 'Encebollado con muzza', NULL, NULL, 'simple', 210.00, true, false, 8, '2026-10-07 23:45:49.168144+00', true),
	('b2634fe2-dc43-45c1-b823-7793c9edfa25', '4edf1fa0-f8a4-49cf-b72f-d1f4464de4e5', '582af425-324b-4fe9-87ec-a279cc2b5b9b', 'Fainá con muzza', NULL, NULL, 'simple', 180.00, true, false, 7, '2026-10-07 23:45:49.168144+00', true),
	('73d5f4a3-b5f1-40ef-b322-8a63d079ebc3', '4edf1fa0-f8a4-49cf-b72f-d1f4464de4e5', '582af425-324b-4fe9-87ec-a279cc2b5b9b', 'Metro de pizza', NULL, NULL, 'simple', 580.00, true, false, 12, '2026-10-07 23:45:49.168144+00', true),
	('15bc964a-75ce-42f1-9c9f-20fc46e2f978', '4edf1fa0-f8a4-49cf-b72f-d1f4464de4e5', '582af425-324b-4fe9-87ec-a279cc2b5b9b', 'Fainá', NULL, NULL, 'simple', 150.00, true, false, 5, '2026-10-07 23:45:49.168144+00', true),
	('e522d33c-f260-4688-80d3-5a27160a5abe', '4edf1fa0-f8a4-49cf-b72f-d1f4464de4e5', '971dac73-8489-4288-86a5-b1164318c0f4', 'DIAVOLA', 'Pepperoni', NULL, 'simple', 590.00, true, false, 13, '2026-10-07 23:46:32.992839+00', true),
	('e7dbdf84-6fc2-4cf2-b61d-88726d92ff0e', '4edf1fa0-f8a4-49cf-b72f-d1f4464de4e5', '971dac73-8489-4288-86a5-b1164318c0f4', 'SICILIANA', 'Panceta y champiñón', NULL, 'simple', 590.00, true, false, 11, '2026-10-07 23:46:32.992839+00', true),
	('c8a7cebe-1721-4804-b2a1-dc7fa34eddb9', '4edf1fa0-f8a4-49cf-b72f-d1f4464de4e5', '971dac73-8489-4288-86a5-b1164318c0f4', 'NAPOLITANA', 'Jamón, tomate, panceta y orégano', NULL, 'simple', 590.00, true, false, 17, '2026-10-07 23:46:32.992839+00', true),
	('38693da3-aa85-4bd8-ad96-b48f7f605810', '4edf1fa0-f8a4-49cf-b72f-d1f4464de4e5', '971dac73-8489-4288-86a5-b1164318c0f4', 'PARISINA', 'Jamón y roquefort', NULL, 'simple', 590.00, true, false, 7, '2026-10-07 23:46:32.992839+00', true),
	('1d44979c-680c-4a65-b623-e43a6ca0c72f', '4edf1fa0-f8a4-49cf-b72f-d1f4464de4e5', '971dac73-8489-4288-86a5-b1164318c0f4', 'SALERNITANA', 'Longaniza y morrón', NULL, 'simple', 590.00, true, false, 9, '2026-10-07 23:46:32.992839+00', true),
	('a79c4d9e-3e86-4c81-9de0-d83e39f486a6', '4edf1fa0-f8a4-49cf-b72f-d1f4464de4e5', '971dac73-8489-4288-86a5-b1164318c0f4', 'CARBONARA', 'Panceta, huevo, aceite de oliva y pimienta negra', NULL, 'simple', 590.00, true, false, 16, '2026-10-07 23:46:32.992839+00', true),
	('d4f98445-1d68-49f0-bcfe-6f23d8c8b228', '4edf1fa0-f8a4-49cf-b72f-d1f4464de4e5', '971dac73-8489-4288-86a5-b1164318c0f4', 'Solo muzza', NULL, NULL, 'simple', 470.00, true, false, 1, '2026-10-07 23:46:32.992839+00', true),
	('736591f7-13fc-4890-bb25-d1991351948a', '4edf1fa0-f8a4-49cf-b72f-d1f4464de4e5', '971dac73-8489-4288-86a5-b1164318c0f4', 'NÓRDICA', 'Jamón y aceitunas', NULL, 'simple', 590.00, true, false, 5, '2026-10-07 23:46:32.992839+00', true),
	('8dfc80b2-08ef-4d56-8b78-e255a5a78d89', '4edf1fa0-f8a4-49cf-b72f-d1f4464de4e5', '971dac73-8489-4288-86a5-b1164318c0f4', 'Solo salsa', NULL, NULL, 'simple', 350.00, true, false, 2, '2026-10-07 23:46:32.992839+00', true),
	('98a6e960-da08-4313-972e-3335d2e59096', '4edf1fa0-f8a4-49cf-b72f-d1f4464de4e5', '971dac73-8489-4288-86a5-b1164318c0f4', 'VESUBIO', 'Longaniza y cebolla', NULL, 'simple', 590.00, true, false, 8, '2026-10-07 23:46:32.992839+00', true),
	('6df8cf02-6bdb-4a76-a2f5-ff63062f019c', '4edf1fa0-f8a4-49cf-b72f-d1f4464de4e5', '971dac73-8489-4288-86a5-b1164318c0f4', 'MARCELLA', 'Jamón y champiñones', NULL, 'simple', 590.00, true, false, 3, '2026-10-07 23:46:32.992839+00', true),
	('790bc418-1dbe-4e69-ad13-60dec3390c02', '4edf1fa0-f8a4-49cf-b72f-d1f4464de4e5', '971dac73-8489-4288-86a5-b1164318c0f4', 'AMERICANA', 'Panceta y cheddar', NULL, 'simple', 590.00, true, false, 4, '2026-10-07 23:46:32.992839+00', true),
	('6a039ff8-172a-4fea-8ace-7fe505769e17', '4edf1fa0-f8a4-49cf-b72f-d1f4464de4e5', '971dac73-8489-4288-86a5-b1164318c0f4', 'FUNGHI', 'Tomate, champiñón y ajo', NULL, 'simple', 590.00, true, false, 15, '2026-10-07 23:46:32.992839+00', true),
	('c2451e58-25bf-4527-8d42-34c5585f3459', '4edf1fa0-f8a4-49cf-b72f-d1f4464de4e5', '971dac73-8489-4288-86a5-b1164318c0f4', 'PALMA', 'Palmitos y jamón', NULL, 'simple', 590.00, true, false, 12, '2026-10-07 23:46:32.992839+00', true),
	('af0cd038-dea7-4c96-948c-53c3475b4cd7', '4edf1fa0-f8a4-49cf-b72f-d1f4464de4e5', '971dac73-8489-4288-86a5-b1164318c0f4', 'HAWAIANA', 'Jamón y ananá', NULL, 'simple', 590.00, true, false, 6, '2026-10-07 23:46:32.992839+00', true),
	('f067766d-a075-4d00-a98a-9009cb7fc9a4', '4edf1fa0-f8a4-49cf-b72f-d1f4464de4e5', '971dac73-8489-4288-86a5-b1164318c0f4', 'FUGAZZETA', 'Cebolla, morrón y parmesano', NULL, 'simple', 590.00, true, false, 10, '2026-10-07 23:46:32.992839+00', true),
	('26fdc571-3d9d-4762-bf34-91a4c5f3cc36', '4edf1fa0-f8a4-49cf-b72f-d1f4464de4e5', '971dac73-8489-4288-86a5-b1164318c0f4', 'CAPRESSE', 'Tomate y albahaca', NULL, 'simple', 590.00, true, false, 14, '2026-10-07 23:46:32.992839+00', true),
	('233d48bb-dcc4-4fa2-8d61-6c4c0ebd4f67', '4edf1fa0-f8a4-49cf-b72f-d1f4464de4e5', '65b58ccd-4f41-4d25-86d2-2f9f3b035b73', 'NAPOLITANO', 'Muzza, tomate, jamón y huevo', NULL, 'simple', 750.00, true, false, 1, '2026-10-07 23:47:11.925066+00', true),
	('d6af8025-9ca5-4c11-9405-b0b144a0054b', '4edf1fa0-f8a4-49cf-b72f-d1f4464de4e5', '65b58ccd-4f41-4d25-86d2-2f9f3b035b73', 'CAPRESSE', 'Tomate, albahaca, muzza y parmesano', NULL, 'simple', 750.00, true, false, 2, '2026-10-07 23:47:11.925066+00', true),
	('16d66585-3259-470a-ad5d-2050833cb1dd', '4edf1fa0-f8a4-49cf-b72f-d1f4464de4e5', '65b58ccd-4f41-4d25-86d2-2f9f3b035b73', 'GRINGO', 'Muzza, panceta, cheddar y huevo duro', NULL, 'simple', 750.00, true, false, 3, '2026-10-07 23:47:11.925066+00', true),
	('246351df-46ab-4ed5-8296-fd5dd6248854', '4edf1fa0-f8a4-49cf-b72f-d1f4464de4e5', '65b58ccd-4f41-4d25-86d2-2f9f3b035b73', 'ESPECIAL', 'Muzza, pollo a la mostaza y cebolla', NULL, 'simple', 750.00, true, false, 4, '2026-10-07 23:47:11.925066+00', true),
	('f4b3e401-3b12-4e3b-a620-3e0cf91259d2', '4edf1fa0-f8a4-49cf-b72f-d1f4464de4e5', '65b58ccd-4f41-4d25-86d2-2f9f3b035b73', 'BARBACOA', 'Muzza, carne picada, barbacoa y cebolla', NULL, 'simple', 750.00, true, false, 5, '2026-10-07 23:47:11.925066+00', true),
	('140d7bb5-6f86-4b5f-9786-90e5833123df', '4edf1fa0-f8a4-49cf-b72f-d1f4464de4e5', '65b58ccd-4f41-4d25-86d2-2f9f3b035b73', 'VEGETARIANO', 'Muzza y mix de verduras salteadas', NULL, 'simple', 750.00, true, false, 6, '2026-10-07 23:47:11.925066+00', true),
	('df8a7f52-0874-4f7d-839c-a269a966a8fe', '4edf1fa0-f8a4-49cf-b72f-d1f4464de4e5', '65b58ccd-4f41-4d25-86d2-2f9f3b035b73', 'JAMÓN Y QUESO', NULL, NULL, 'simple', 680.00, true, false, 7, '2026-10-07 23:47:11.925066+00', true),
	('e483e8ad-fa8d-404f-9843-94462600de07', '4edf1fa0-f8a4-49cf-b72f-d1f4464de4e5', '65b58ccd-4f41-4d25-86d2-2f9f3b035b73', 'PIAMONTE', 'Muzza, pollo, cheddar, papas fritas y huevos fritos', NULL, 'simple', 810.00, true, false, 8, '2026-10-07 23:47:11.925066+00', true),
	('4caf1ce7-87fb-4838-86a1-446149b8abd4', '4edf1fa0-f8a4-49cf-b72f-d1f4464de4e5', '96a8981f-a2b4-45bf-8651-b357c716f32f', 'PROSCIUTTO', 'Jamón crudo, rúcula y parmesano', NULL, 'simple', 620.00, true, false, 1, '2026-10-07 23:47:11.925066+00', true),
	('1658e957-70e9-40ec-a6fe-67d182d219d3', '4edf1fa0-f8a4-49cf-b72f-d1f4464de4e5', '96a8981f-a2b4-45bf-8651-b357c716f32f', 'CAPRICCIOSA', 'Panceta, roquefort, aceitunas y champi', NULL, 'simple', 620.00, true, false, 2, '2026-10-07 23:47:11.925066+00', true),
	('537c689b-79cd-4c40-9be4-2762688698c4', '4edf1fa0-f8a4-49cf-b72f-d1f4464de4e5', '96a8981f-a2b4-45bf-8651-b357c716f32f', 'A LA CARUSSO', 'Muzzarella y salsa carusso', NULL, 'simple', 690.00, true, false, 3, '2026-10-07 23:47:11.925066+00', true),
	('2af3dc46-1521-402c-af3e-485c9fa0b8d6', '4edf1fa0-f8a4-49cf-b72f-d1f4464de4e5', '96a8981f-a2b4-45bf-8651-b357c716f32f', 'AL PESTO', 'Muzza, pesto, parmesano y nueces', NULL, 'simple', 690.00, true, false, 4, '2026-10-07 23:47:11.925066+00', true),
	('4837ea25-ebd2-4cd9-8f9b-bfe3ad7741bb', '4edf1fa0-f8a4-49cf-b72f-d1f4464de4e5', '96a8981f-a2b4-45bf-8651-b357c716f32f', 'BARBACOA', 'Carne picada, cebolla y salsa barbacoa', NULL, 'simple', 650.00, true, false, 5, '2026-10-07 23:47:11.925066+00', true),
	('c8d12513-e31d-4709-b99e-822d39dd4fdb', '4edf1fa0-f8a4-49cf-b72f-d1f4464de4e5', '96a8981f-a2b4-45bf-8651-b357c716f32f', 'PAULINA', 'Pollo y cebolla', NULL, 'simple', 620.00, true, false, 6, '2026-10-07 23:47:11.925066+00', true),
	('2e5a3a22-ddb1-4b7d-8223-2eed3cb965d9', '4edf1fa0-f8a4-49cf-b72f-d1f4464de4e5', '96a8981f-a2b4-45bf-8651-b357c716f32f', '4 QUESOS', 'Parmesano, cheddar, roquefort y muzzarella', NULL, 'simple', 620.00, true, false, 7, '2026-10-07 23:47:11.925066+00', true),
	('8a4d2fa8-de1b-4dc6-9a75-d4a921313333', '4edf1fa0-f8a4-49cf-b72f-d1f4464de4e5', '96a8981f-a2b4-45bf-8651-b357c716f32f', 'VEGETARIANA', 'Mix de verduras salteadas', NULL, 'simple', 590.00, true, false, 8, '2026-10-07 23:47:11.925066+00', true),
	('bc0ce296-d455-48f3-ab3c-de9c9062550b', '4edf1fa0-f8a4-49cf-b72f-d1f4464de4e5', '96a8981f-a2b4-45bf-8651-b357c716f32f', 'PIAMONTE', 'Muzza, panceta, cheddar, papas fritas y 4 huevos fritos', NULL, 'simple', 810.00, true, false, 9, '2026-10-07 23:47:11.925066+00', true),
	('8d0ddca0-0a73-4402-8a14-cf7336f31664', '4edf1fa0-f8a4-49cf-b72f-d1f4464de4e5', '96a8981f-a2b4-45bf-8651-b357c716f32f', 'Pizzetas Mitad y Mitad', 'No incluye Piamonte', NULL, 'simple', 620.00, true, false, 10, '2026-10-07 23:47:11.925066+00', true),
	('fbfbe3ae-136c-4b24-b078-17ccd65c7722', '4edf1fa0-f8a4-49cf-b72f-d1f4464de4e5', '80db5624-7f71-49ac-b141-b8e81df50803', 'CHEESE BURGER', 'Cheddar, mayo y ketchup. Doble carne, con fritas', NULL, 'simple', 380.00, true, false, 1, '2026-10-07 23:47:11.925066+00', true),
	('f56d25eb-3367-4103-bcab-39ec74b9026e', '4edf1fa0-f8a4-49cf-b72f-d1f4464de4e5', '80db5624-7f71-49ac-b141-b8e81df50803', 'HAMBURGUESA CRIOLLA', 'Muzzarella, panceta, mostaza, huevo frito', NULL, 'simple', 510.00, true, false, 2, '2026-10-07 23:47:11.925066+00', true),
	('40e844b3-90f6-477a-9f0f-addff9ca884b', '4edf1fa0-f8a4-49cf-b72f-d1f4464de4e5', '80db5624-7f71-49ac-b141-b8e81df50803', 'HAMBURGUESA BARBACUE', 'Cebolla caramelizada, huevo frito, cheddar, barbacoa, panceta', NULL, 'simple', 510.00, true, false, 3, '2026-10-07 23:47:11.925066+00', true),
	('c4cd2b57-b955-4270-b903-38a56fc9eb59', '4edf1fa0-f8a4-49cf-b72f-d1f4464de4e5', '80db5624-7f71-49ac-b141-b8e81df50803', 'HAMBURGUESA CAPRESSE', 'Muzzarella, tomate, albahaca', NULL, 'simple', 510.00, true, false, 4, '2026-10-07 23:47:11.925066+00', true),
	('bb519ae2-64e4-46ee-8ff1-f73f7ff04bb9', '4edf1fa0-f8a4-49cf-b72f-d1f4464de4e5', '80db5624-7f71-49ac-b141-b8e81df50803', 'HAMBURGUESA FRENCH', 'Muzzarella, panceta, champiñón, roquefort, parmesano', NULL, 'simple', 510.00, true, false, 5, '2026-10-07 23:47:11.925066+00', true),
	('33343e2d-82dd-4a3d-bd59-31e379dc37e8', '4edf1fa0-f8a4-49cf-b72f-d1f4464de4e5', '80db5624-7f71-49ac-b141-b8e81df50803', 'HAMBURGUESA DE QUESOS', 'Muzzarella, cheddar, queso sándwich, roquefort, parmesano', NULL, 'simple', 510.00, true, false, 6, '2026-10-07 23:47:11.925066+00', true),
	('83ba4fb9-9ab3-4230-855b-dee1f32fc37d', '4edf1fa0-f8a4-49cf-b72f-d1f4464de4e5', '80db5624-7f71-49ac-b141-b8e81df50803', 'HAMBURGUESA VEGETARIANA', 'Hamburguesa de lentejas, lechuga, tomate, cebolla caramelizada, champiñón, salsa de soja', NULL, 'simple', 510.00, true, false, 7, '2026-10-07 23:47:11.925066+00', true),
	('e815895b-ab00-4ad0-9892-15a01cfcee07', '4edf1fa0-f8a4-49cf-b72f-d1f4464de4e5', '582af425-324b-4fe9-87ec-a279cc2b5b9b', 'Muzzarella', NULL, NULL, 'simple', 250.00, true, false, 2, '2026-10-07 23:41:01.73076+00', true),
	('8096aa0c-dff9-4644-8cca-88d34cfa5ee3', '4edf1fa0-f8a4-49cf-b72f-d1f4464de4e5', '80db5624-7f71-49ac-b141-b8e81df50803', 'HAMBURGUESA COMPLETA', 'Lechuga, tomate, huevo frito, jamón, muzzarella, panceta', NULL, 'simple', 510.00, true, false, 8, '2026-10-07 23:47:11.925066+00', true),
	('52fd6c40-6a48-4f8b-871b-66a204abfca7', '4edf1fa0-f8a4-49cf-b72f-d1f4464de4e5', '80db5624-7f71-49ac-b141-b8e81df50803', 'HAMBURGUESA BIG', 'Lechuga, salsa BIG casera, cheddar, cebolla, pepinillos, panceta', NULL, 'simple', 510.00, true, false, 9, '2026-10-07 23:47:11.925066+00', true),
	('1404886d-0d81-4eb2-bf7d-5cff67cfe6f9', '4edf1fa0-f8a4-49cf-b72f-d1f4464de4e5', '80db5624-7f71-49ac-b141-b8e81df50803', 'HAMBURGUESA COMÚN', 'Lechuga, tomate, huevo duro', NULL, 'simple', 390.00, true, false, 10, '2026-10-07 23:47:11.925066+00', true),
	('f27f5c54-307f-4e85-b125-e32f516092b7', '4edf1fa0-f8a4-49cf-b72f-d1f4464de4e5', '80db5624-7f71-49ac-b141-b8e81df50803', 'PIAMONTE BURGER', 'Triple carne, jamón, muzzarella, cebolla, panceta, cheddar, huevo, tomate, lechuga y papas rústicas', NULL, 'simple', 580.00, true, false, 11, '2026-10-07 23:47:11.925066+00', true),
	('096d4309-5cd6-4fa4-9f8a-8e03c16d34ca', '4edf1fa0-f8a4-49cf-b72f-d1f4464de4e5', '80db5624-7f71-49ac-b141-b8e81df50803', 'SUPER BAURÚ', '350g carne, arvejas, choclo, omelette, cebolla, panceta, morrón, aceitunas, jamón, muzza, mayonesa, ketchup y mostaza. Con fritas', NULL, 'simple', 890.00, true, false, 12, '2026-10-07 23:47:11.925066+00', true),
	('0daf3888-6196-495f-9471-a6174fff5d85', '4edf1fa0-f8a4-49cf-b72f-d1f4464de4e5', '4d3091e0-d119-4f80-b484-7a3642e39e7d', 'COMÚN al pan con fritas', 'Lechuga, tomate, huevo duro, jamón y muzzarella', NULL, 'simple', 470.00, true, false, 1, '2026-10-07 23:47:11.925066+00', true),
	('09b2d42d-94be-491e-b32b-34742438c941', '4edf1fa0-f8a4-49cf-b72f-d1f4464de4e5', '4d3091e0-d119-4f80-b484-7a3642e39e7d', 'CANADIENSE al pan con fritas', 'Jamón, muzzarella, panceta, tomate, huevo frito, lechuga, cebolla, morrón, champiñones y aceitunas', NULL, 'simple', 590.00, true, false, 2, '2026-10-07 23:47:11.925066+00', true),
	('d53a090c-1d95-48fe-bd14-2c62fa614b08', '4edf1fa0-f8a4-49cf-b72f-d1f4464de4e5', '4d3091e0-d119-4f80-b484-7a3642e39e7d', 'CANADIENSE al plato (para uno, 3 guarniciones)', NULL, NULL, 'simple', 550.00, true, false, 3, '2026-10-07 23:47:11.925066+00', true),
	('8c77a4ea-8467-4e8d-a482-fb1145cb9b1e', '4edf1fa0-f8a4-49cf-b72f-d1f4464de4e5', '4d3091e0-d119-4f80-b484-7a3642e39e7d', 'CANADIENSE al plato (para dos, 3 guarniciones)', NULL, NULL, 'simple', 960.00, true, false, 4, '2026-10-07 23:47:11.925066+00', true),
	('a09787bb-7e12-4712-82c9-92e209f10c48', '4edf1fa0-f8a4-49cf-b72f-d1f4464de4e5', '7399a0c2-66ec-4114-b181-49884129b5e9', 'Fritas', NULL, NULL, 'simple', 280.00, true, false, 1, '2026-10-07 23:47:11.925066+00', true),
	('c8e28a1c-62bb-482c-ad67-cb4a5d059ff1', '4edf1fa0-f8a4-49cf-b72f-d1f4464de4e5', '7399a0c2-66ec-4114-b181-49884129b5e9', 'Noissettes', NULL, NULL, 'simple', 310.00, true, false, 2, '2026-10-07 23:47:11.925066+00', true),
	('2132e2a8-27c5-48e2-8995-19dae307e9e2', '4edf1fa0-f8a4-49cf-b72f-d1f4464de4e5', '7399a0c2-66ec-4114-b181-49884129b5e9', 'Rústicas', NULL, NULL, 'simple', 310.00, true, false, 3, '2026-10-07 23:47:11.925066+00', true),
	('c7a67b70-57dc-4c8a-ac03-4a017263504a', '4edf1fa0-f8a4-49cf-b72f-d1f4464de4e5', '7399a0c2-66ec-4114-b181-49884129b5e9', 'Nuggets (14 u.)', NULL, NULL, 'simple', 430.00, true, false, 4, '2026-10-07 23:47:11.925066+00', true),
	('e6a8fb92-9e2c-4328-85cd-93e7882bd33a', '4edf1fa0-f8a4-49cf-b72f-d1f4464de4e5', '7399a0c2-66ec-4114-b181-49884129b5e9', 'Arrolladitos primavera (12 u.)', NULL, NULL, 'simple', 380.00, true, false, 5, '2026-10-07 23:47:11.925066+00', true),
	('22486571-886f-4810-a926-003ef27bddbf', '4edf1fa0-f8a4-49cf-b72f-d1f4464de4e5', '7399a0c2-66ec-4114-b181-49884129b5e9', 'Bastones de muzzarella (8 u.)', NULL, NULL, 'simple', 470.00, true, false, 6, '2026-10-07 23:47:11.925066+00', true),
	('a3d27649-3748-488d-849b-aab219a0eeac', '4edf1fa0-f8a4-49cf-b72f-d1f4464de4e5', '7399a0c2-66ec-4114-b181-49884129b5e9', 'Aros de cebolla (12 u.)', NULL, NULL, 'simple', 380.00, true, false, 7, '2026-10-07 23:47:11.925066+00', true),
	('ebb11619-602a-4167-a6a5-84852e0e4071', '4edf1fa0-f8a4-49cf-b72f-d1f4464de4e5', '53430e50-f5de-4b87-a880-9df2adc1a174', 'JAMÓN Y QUESO', NULL, NULL, 'simple', 290.00, true, false, 1, '2026-10-07 23:47:11.925066+00', true),
	('661dda76-bd73-4215-8ab8-449318b6860c', '4edf1fa0-f8a4-49cf-b72f-d1f4464de4e5', '53430e50-f5de-4b87-a880-9df2adc1a174', 'CALIENTE CON MUZZA', NULL, NULL, 'simple', 330.00, true, false, 2, '2026-10-07 23:47:11.925066+00', true),
	('20e2bdf5-56cc-4890-afe4-7824b4dca377', '4edf1fa0-f8a4-49cf-b72f-d1f4464de4e5', '53430e50-f5de-4b87-a880-9df2adc1a174', 'NAPOLITANO', 'Jamón, queso, muzzarella, tomate y orégano', NULL, 'simple', 380.00, true, false, 3, '2026-10-07 23:47:11.925066+00', true),
	('001db75f-0af8-4c8b-83f7-1e01fd8d421b', '4edf1fa0-f8a4-49cf-b72f-d1f4464de4e5', '53430e50-f5de-4b87-a880-9df2adc1a174', 'ESPECIAL', 'Panceta, queso, muzzarella, cheddar y jamón', NULL, 'simple', 380.00, true, false, 4, '2026-10-07 23:47:11.925066+00', true),
	('19e45423-f70a-467b-a06c-ab8389bb004d', '4edf1fa0-f8a4-49cf-b72f-d1f4464de4e5', '53430e50-f5de-4b87-a880-9df2adc1a174', 'CARIBEAN', 'Ananá, jamón, muzzarella, queso y choclo', NULL, 'simple', 380.00, true, false, 5, '2026-10-07 23:47:11.925066+00', true),
	('9f0bcaac-d368-4cb4-8b67-c25f71cc751f', '4edf1fa0-f8a4-49cf-b72f-d1f4464de4e5', '53430e50-f5de-4b87-a880-9df2adc1a174', 'VEGETARIANO', 'Tomate, huevo, muzzarella, queso y choclo', NULL, 'simple', 380.00, true, false, 6, '2026-10-07 23:47:11.925066+00', true),
	('8ff62476-5ddf-4b17-81b6-b4db3b5fd36f', '4edf1fa0-f8a4-49cf-b72f-d1f4464de4e5', '6e70e6ed-c8b8-400c-9ec6-f3064de9279a', 'MILA CHEDDAR', 'Cubierta con salsa de cheddar y panceta, un huevo frito, con papas fritas', NULL, 'simple', 570.00, true, false, 1, '2026-10-07 23:48:10.934842+00', true),
	('f95d199b-121d-45fb-ace6-48fb95afe176', '4edf1fa0-f8a4-49cf-b72f-d1f4464de4e5', '6e70e6ed-c8b8-400c-9ec6-f3064de9279a', 'MILA NÓRDICA', 'Jamón, muzzarella, aceitunas, cebolla y morrón, con papas fritas', NULL, 'simple', 570.00, true, false, 2, '2026-10-07 23:48:10.934842+00', true),
	('2910125f-bdba-425c-bd23-dff8b1760cd1', '4edf1fa0-f8a4-49cf-b72f-d1f4464de4e5', '6e70e6ed-c8b8-400c-9ec6-f3064de9279a', 'MILA CAPRESSE', 'Cubierta con salsa base, muzzarella, tomate y albahaca, con papas fritas', NULL, 'simple', 570.00, true, false, 3, '2026-10-07 23:48:10.934842+00', true),
	('f3ab2971-2ce8-485c-9b3c-5927784aa9e7', '4edf1fa0-f8a4-49cf-b72f-d1f4464de4e5', '6e70e6ed-c8b8-400c-9ec6-f3064de9279a', 'MILA DE PUERRO', 'Cubierta con salsa de puerros y panceta, con papas fritas', NULL, 'simple', 570.00, true, false, 4, '2026-10-07 23:48:10.934842+00', true),
	('f3c3c37d-81ae-427e-977a-5d733f90a955', '4edf1fa0-f8a4-49cf-b72f-d1f4464de4e5', '6e70e6ed-c8b8-400c-9ec6-f3064de9279a', 'MILA AL ROQUEFORT', 'Cubierta en salsa roquefort y cebolla caramelizada, con papas fritas', NULL, 'simple', 570.00, true, false, 5, '2026-10-07 23:48:10.934842+00', true),
	('c47bc0c2-314d-435f-8e05-403f19103291', '4edf1fa0-f8a4-49cf-b72f-d1f4464de4e5', '6e70e6ed-c8b8-400c-9ec6-f3064de9279a', 'MILA CHAMPIÑÓN', 'Cubierta en salsa champiñón, con papas fritas', NULL, 'simple', 570.00, true, false, 6, '2026-10-07 23:48:10.934842+00', true),
	('097e030f-b135-4ac5-bfa7-e4d60cba053c', '4edf1fa0-f8a4-49cf-b72f-d1f4464de4e5', 'a9920984-bde9-41ff-9bdd-904108ac2366', 'MILANESA al plato con fritas', NULL, NULL, 'simple', 410.00, true, false, 1, '2026-10-07 23:48:10.934842+00', true),
	('99647a11-e49b-455e-bce0-04c41c87e810', '4edf1fa0-f8a4-49cf-b72f-d1f4464de4e5', 'a9920984-bde9-41ff-9bdd-904108ac2366', 'MILA COMÚN al pan', 'Lechuga, tomate, jamón, muzzarella y huevo. Con fritas', NULL, 'simple', 490.00, true, false, 2, '2026-10-07 23:48:10.934842+00', true),
	('645e62ec-ba71-4477-9ae3-5d53e31e8ecc', '4edf1fa0-f8a4-49cf-b72f-d1f4464de4e5', 'a9920984-bde9-41ff-9bdd-904108ac2366', 'MILANESA en dos panes', 'Lechuga, tomate, huevo, jamón, morrón, muzzarella, cheddar y cebolla. Con fritas', NULL, 'simple', 650.00, true, false, 3, '2026-10-07 23:48:10.934842+00', true),
	('9324f709-4629-496c-a10a-f27c2a95f4af', '4edf1fa0-f8a4-49cf-b72f-d1f4464de4e5', 'a9920984-bde9-41ff-9bdd-904108ac2366', 'MILANESA NAPOLITANA', NULL, NULL, 'simple', 570.00, true, false, 4, '2026-10-07 23:48:10.934842+00', true),
	('fb4e5809-a547-40d4-9aad-bab8c894b1cf', '4edf1fa0-f8a4-49cf-b72f-d1f4464de4e5', 'a9920984-bde9-41ff-9bdd-904108ac2366', 'TABLA DE MILANESAS PARA TRES PERSONAS', 'Degustación de mini milanesas gourmet en colchón de fritas', NULL, 'simple', 1550.00, true, false, 5, '2026-10-07 23:48:10.934842+00', true),
	('ed9bea68-a9fc-4b97-8cde-2d69de0ead43', '4edf1fa0-f8a4-49cf-b72f-d1f4464de4e5', '1da3d900-94ab-4945-9d65-4be6687a1d13', 'CHEDDAR Y PANCETA', NULL, NULL, 'simple', 390.00, true, false, 2, '2026-10-07 23:48:10.934842+00', true),
	('7d0906a7-6caf-4b92-82df-55c1301856a5', '4edf1fa0-f8a4-49cf-b72f-d1f4464de4e5', '1da3d900-94ab-4945-9d65-4be6687a1d13', 'CAPRESSE', NULL, NULL, 'simple', 390.00, true, false, 3, '2026-10-07 23:48:10.934842+00', true),
	('5203d60b-dfce-43ce-9aae-c32344564e8f', '4edf1fa0-f8a4-49cf-b72f-d1f4464de4e5', '1da3d900-94ab-4945-9d65-4be6687a1d13', '4 QUESOS', NULL, NULL, 'simple', 390.00, true, false, 4, '2026-10-07 23:48:10.934842+00', true),
	('558c0ef4-50e7-4bb8-ae75-63993d130597', '4edf1fa0-f8a4-49cf-b72f-d1f4464de4e5', '1da3d900-94ab-4945-9d65-4be6687a1d13', 'CHAMPI', NULL, NULL, 'simple', 390.00, true, false, 5, '2026-10-07 23:48:10.934842+00', true),
	('5a9a7db4-ba3f-4ab9-9253-40b741eca49c', '4edf1fa0-f8a4-49cf-b72f-d1f4464de4e5', 'f7626245-9fef-429f-8e30-c185015c0af3', 'PICADA PARA DOS PERSONAS', 'Aros de cebolla, arrolladitos primavera, bastones de muzzarella, nuggets y papas fritas', NULL, 'simple', 770.00, true, false, 1, '2026-10-07 23:48:10.934842+00', true),
	('0fdbf807-149f-40cd-8b3a-f59917b6fc39', '4edf1fa0-f8a4-49cf-b72f-d1f4464de4e5', 'f7626245-9fef-429f-8e30-c185015c0af3', 'PICADA PARA CUATRO PERSONAS', 'Aros de cebolla, arrolladitos primavera, nuggets, bastones de muzzarella, fritas, muzzarella, pizza, fainá y figazza', NULL, 'simple', 1300.00, true, false, 2, '2026-10-07 23:48:10.934842+00', true),
	('d733aa95-ef65-4445-b92f-274e94724429', '4edf1fa0-f8a4-49cf-b72f-d1f4464de4e5', 'f7626245-9fef-429f-8e30-c185015c0af3', 'MILA PICADA', 'Disponible solo en picada de 2 y 4 personas', NULL, 'simple', 140.00, true, false, 3, '2026-10-07 23:48:10.934842+00', true),
	('93f28174-ad10-41dd-a0d9-dbf24565f1b0', '4edf1fa0-f8a4-49cf-b72f-d1f4464de4e5', '91b95b20-6473-4dbb-9940-4f242f3d7c23', 'Refresco línea Pepsi 1.5 L', NULL, NULL, 'simple', 220.00, true, false, 1, '2026-10-07 23:48:10.934842+00', true),
	('4fc68d24-c5f8-4f99-8e3a-94e1abe664c2', '4edf1fa0-f8a4-49cf-b72f-d1f4464de4e5', '91b95b20-6473-4dbb-9940-4f242f3d7c23', 'Refresco 500 ml', NULL, NULL, 'simple', 120.00, true, false, 2, '2026-10-07 23:48:10.934842+00', true),
	('e019149c-4103-4008-8c31-a4b9cf31d9bf', '4edf1fa0-f8a4-49cf-b72f-d1f4464de4e5', '91b95b20-6473-4dbb-9940-4f242f3d7c23', 'Pilsen', NULL, NULL, 'simple', 250.00, true, false, 3, '2026-10-07 23:48:10.934842+00', true),
	('8c368bc5-0a23-45ef-b5c8-ad09f470f4ae', '4edf1fa0-f8a4-49cf-b72f-d1f4464de4e5', '91b95b20-6473-4dbb-9940-4f242f3d7c23', 'Patricia', NULL, NULL, 'simple', 290.00, true, false, 4, '2026-10-07 23:48:10.934842+00', true),
	('142bec29-e870-4952-8763-f1f5c5a75842', '4edf1fa0-f8a4-49cf-b72f-d1f4464de4e5', '91b95b20-6473-4dbb-9940-4f242f3d7c23', 'Zillertal', NULL, NULL, 'simple', 310.00, true, false, 5, '2026-10-07 23:48:10.934842+00', true),
	('e54e2de6-9616-4140-9fb1-74eb76e53a05', '4edf1fa0-f8a4-49cf-b72f-d1f4464de4e5', '91b95b20-6473-4dbb-9940-4f242f3d7c23', 'Zillertal IPA', NULL, NULL, 'simple', 290.00, true, false, 6, '2026-10-07 23:48:10.934842+00', true),
	('deece29f-1424-4599-9592-fb260d388e2b', '4edf1fa0-f8a4-49cf-b72f-d1f4464de4e5', '91b95b20-6473-4dbb-9940-4f242f3d7c23', 'Stella Artois', NULL, NULL, 'simple', 320.00, true, false, 7, '2026-10-07 23:48:10.934842+00', true),
	('915c18ab-e250-41bf-b3fb-19bea7cf4da5', '4edf1fa0-f8a4-49cf-b72f-d1f4464de4e5', '91b95b20-6473-4dbb-9940-4f242f3d7c23', 'Lata cerveza 473 ml', NULL, NULL, 'simple', 180.00, true, false, 8, '2026-10-07 23:48:10.934842+00', true),
	('f961f83f-cd89-4f3b-9c55-78b904137b41', '4edf1fa0-f8a4-49cf-b72f-d1f4464de4e5', '4d09d361-5b34-4c6b-8f2d-92caf21241fa', 'PROMO 4', 'Metro de muzza + 2 fainá', NULL, 'combo', 920.00, true, false, 4, '2026-10-07 23:50:46.455224+00', true),
	('e6257319-6afe-4304-937a-76d24fd094ae', '4edf1fa0-f8a4-49cf-b72f-d1f4464de4e5', '4d09d361-5b34-4c6b-8f2d-92caf21241fa', 'PROMO 5', 'Napolitana para dos + refresco o Pilsen', NULL, 'combo', 1150.00, true, false, 5, '2026-10-07 23:50:46.455224+00', true),
	('1f89c2e4-bf6c-423d-adeb-e1cf8b54f3cf', '4edf1fa0-f8a4-49cf-b72f-d1f4464de4e5', '4d09d361-5b34-4c6b-8f2d-92caf21241fa', 'PROMO 6', '½ muzza + 2 gustos + 2 fainá', NULL, 'combo', 780.00, true, false, 6, '2026-10-07 23:50:46.455224+00', true),
	('676f3eee-8851-4361-a17d-edc3837273ac', '4edf1fa0-f8a4-49cf-b72f-d1f4464de4e5', '4d09d361-5b34-4c6b-8f2d-92caf21241fa', 'PROMO 7', '½ pizza + 1 fainá', NULL, 'combo', 430.00, true, false, 7, '2026-10-07 23:50:46.455224+00', true),
	('829e5d16-d2b2-4852-92a8-d304c5567867', '4edf1fa0-f8a4-49cf-b72f-d1f4464de4e5', '4d09d361-5b34-4c6b-8f2d-92caf21241fa', 'PROMO 8', 'Metro de pizza + 2 fainá', NULL, 'combo', 650.00, true, false, 8, '2026-10-07 23:50:46.455224+00', true),
	('3ed81c70-e2d3-4082-9a4d-3026c0f6f504', '4edf1fa0-f8a4-49cf-b72f-d1f4464de4e5', '4d09d361-5b34-4c6b-8f2d-92caf21241fa', 'PROMO 9', 'Calzone de muzzarella + 2 gustos + refresco o Pilsen', NULL, 'combo', 890.00, true, false, 9, '2026-10-07 23:50:46.455224+00', true),
	('533bda5e-91d2-4925-a959-6b208a6104b6', '4edf1fa0-f8a4-49cf-b72f-d1f4464de4e5', '4d09d361-5b34-4c6b-8f2d-92caf21241fa', 'PROMO 11', 'Super Baurú + refresco o Pilsen', NULL, 'combo', 1050.00, true, false, 11, '2026-10-07 23:50:46.455224+00', true),
	('560149eb-560b-4627-b7ad-9a9717dc6a37', '4edf1fa0-f8a4-49cf-b72f-d1f4464de4e5', '4d09d361-5b34-4c6b-8f2d-92caf21241fa', 'PROMO 12', 'Picada para cuatro + refresco o Pilsen', NULL, 'combo', 1450.00, true, false, 12, '2026-10-07 23:50:46.455224+00', true),
	('4443f27d-ee24-4988-b5db-7990fab114ab', '4edf1fa0-f8a4-49cf-b72f-d1f4464de4e5', '4d09d361-5b34-4c6b-8f2d-92caf21241fa', 'PROMO 10 · LEHMEYUN 6x5', 'Pagás 5 y llevás 6. Unidad $130; con muzza $160', NULL, 'combo', 650.00, true, false, 10, '2026-10-07 23:50:46.455224+00', true),
	('74a95f95-5952-48f3-83d1-9625a6ded3aa', '4edf1fa0-f8a4-49cf-b72f-d1f4464de4e5', '4d09d361-5b34-4c6b-8f2d-92caf21241fa', 'PIZZA RELLENA', 'Rellena de jamón, queso, tomate y huevo', NULL, 'simple', 370.00, true, true, 1, '2026-10-07 23:49:00.279091+00', true),
	('e9ba70d3-1920-47ac-8639-02161253790a', '4edf1fa0-f8a4-49cf-b72f-d1f4464de4e5', '4d09d361-5b34-4c6b-8f2d-92caf21241fa', 'MUZZA RELLENA', 'Rellena de jamón, queso, tomate y huevo', NULL, 'simple', 450.00, true, true, 2, '2026-10-07 23:49:00.279091+00', false),
	('935e7198-2776-4477-a721-e82d9fda1880', '4edf1fa0-f8a4-49cf-b72f-d1f4464de4e5', '582af425-324b-4fe9-87ec-a279cc2b5b9b', 'Pizza', NULL, NULL, 'simple', 160.00, true, true, 1, '2026-10-07 23:41:01.73076+00', true),
	('e7f75864-c383-4b05-93ca-5313b7aaf285', '4edf1fa0-f8a4-49cf-b72f-d1f4464de4e5', '1da3d900-94ab-4945-9d65-4be6687a1d13', 'GRAMAJO', NULL, NULL, 'simple', 390.00, true, false, 1, '2026-10-07 23:48:10.934842+00', true),
	('0710ac81-f1fd-42a6-a747-9a00cc5105d9', '4edf1fa0-f8a4-49cf-b72f-d1f4464de4e5', '4d09d361-5b34-4c6b-8f2d-92caf21241fa', 'prueba1', 'ninguna', NULL, 'simple', 0.01, false, false, 1, '2026-10-10 06:08:51.27739+00', false),
	('a9f773ec-d8d6-4c66-9d20-77755bb79560', '4edf1fa0-f8a4-49cf-b72f-d1f4464de4e5', '4d09d361-5b34-4c6b-8f2d-92caf21241fa', 'PROMO 2', '½ muzza + 1 fainá', NULL, 'combo', 580.00, true, false, 2, '2026-10-07 23:50:46.455224+00', true),
	('ad9a2dc1-3ac9-462f-aaab-64d16ece5d82', '4edf1fa0-f8a4-49cf-b72f-d1f4464de4e5', '4d09d361-5b34-4c6b-8f2d-92caf21241fa', 'PROMO 3', '1 muzza + 1 pizza + 1 fainá + refresco o Pilsen', NULL, 'combo', 710.00, true, false, 3, '2026-10-07 23:50:46.455224+00', true),
	('e2f14a9c-e4e5-4e53-9b07-eabd74a77f60', '4edf1fa0-f8a4-49cf-b72f-d1f4464de4e5', '4d09d361-5b34-4c6b-8f2d-92caf21241fa', 'PROMO 1', '½ muzza + ½ pizza + 3 fainá + refresco o Pilsen', NULL, 'combo', 1150.00, true, false, 1, '2026-10-07 23:50:46.455224+00', true);


--
-- Data for Name: grupos_opciones; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."grupos_opciones" ("id", "producto_id", "nombre", "minimo", "maximo", "obligatorio", "activo", "orden", "creado_en") VALUES
	('42572a56-58d5-48dc-9005-2dbd48bab56b', '935e7198-2776-4477-a721-e82d9fda1880', 'Elegí tus gustos', 0, 2, false, true, 1, '2026-10-07 23:42:28.553543+00'),
	('3fc4644a-2501-4281-a240-59198703c702', 'e815895b-ab00-4ad0-9892-15a01cfcee07', 'Elegí tus gustos', 0, 2, false, true, 1, '2026-10-07 23:42:28.553543+00');


--
-- Data for Name: opciones; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."opciones" ("id", "grupo_id", "nombre", "precio_adicional", "disponible", "orden", "creado_en") VALUES
	('f407c625-1fe5-440f-9308-0b817a48e52a', '42572a56-58d5-48dc-9005-2dbd48bab56b', 'Jamón', 0.00, true, 1, '2026-10-08 01:30:21.383368+00'),
	('21e1afe0-93ea-4dd7-a04c-bfb9ddc03d3e', '42572a56-58d5-48dc-9005-2dbd48bab56b', 'Panceta', 0.00, true, 2, '2026-10-08 01:30:21.383368+00'),
	('a80db480-2507-422e-861d-864c4b0f8eba', '42572a56-58d5-48dc-9005-2dbd48bab56b', 'Aceitunas', 0.00, true, 3, '2026-10-08 01:30:21.383368+00'),
	('489d732d-12c0-4bef-8ee3-acbe3c0bdcf0', '42572a56-58d5-48dc-9005-2dbd48bab56b', 'Cebolla', 0.00, true, 4, '2026-10-08 01:30:21.383368+00'),
	('b58d8551-e446-4d3e-8dcc-31ae8d995f7f', '42572a56-58d5-48dc-9005-2dbd48bab56b', 'Morrón', 0.00, true, 5, '2026-10-08 01:30:21.383368+00'),
	('7dae298d-2c9c-4cbb-9095-f4eaa04519f1', '42572a56-58d5-48dc-9005-2dbd48bab56b', 'Champiñones', 0.00, true, 6, '2026-10-08 01:30:21.383368+00'),
	('c8593aac-ed17-4540-b7e6-242a496894f1', '42572a56-58d5-48dc-9005-2dbd48bab56b', 'Ananá', 0.00, true, 7, '2026-10-08 01:30:21.383368+00'),
	('113c1745-596f-4dab-9728-7907ea67e9e1', '42572a56-58d5-48dc-9005-2dbd48bab56b', 'Longaniza', 0.00, true, 8, '2026-10-08 01:30:21.383368+00'),
	('a1f28845-6353-4efb-a696-ae9237dc7b1a', '42572a56-58d5-48dc-9005-2dbd48bab56b', 'Huevo', 0.00, true, 9, '2026-10-08 01:30:21.383368+00'),
	('2532f3c2-1164-4721-a219-60421873c3e7', '42572a56-58d5-48dc-9005-2dbd48bab56b', 'Cheddar', 0.00, true, 10, '2026-10-08 01:30:21.383368+00'),
	('0b4e8d03-112a-48d4-a2d4-8c6a0f9e92b5', '42572a56-58d5-48dc-9005-2dbd48bab56b', 'Roquefort', 0.00, true, 11, '2026-10-08 01:30:21.383368+00'),
	('e117bad3-c932-4c68-b1f0-2794c42b4e17', '3fc4644a-2501-4281-a240-59198703c702', 'Jamón', 0.00, true, 1, '2026-10-08 01:30:21.383368+00'),
	('63faa6e5-da70-44c4-8cd2-bfbcfd711de0', '3fc4644a-2501-4281-a240-59198703c702', 'Panceta', 0.00, true, 2, '2026-10-08 01:30:21.383368+00'),
	('04d42338-fee7-4495-a56e-eebf932b8a37', '3fc4644a-2501-4281-a240-59198703c702', 'Aceitunas', 0.00, true, 3, '2026-10-08 01:30:21.383368+00'),
	('9ac6dde1-d2c1-4610-831f-4d7181b485e2', '3fc4644a-2501-4281-a240-59198703c702', 'Cebolla', 0.00, true, 4, '2026-10-08 01:30:21.383368+00'),
	('c5ee90d7-4d73-4c55-8bd7-b772c70058f0', '3fc4644a-2501-4281-a240-59198703c702', 'Morrón', 0.00, true, 5, '2026-10-08 01:30:21.383368+00'),
	('6dcaeb27-2a31-4a2f-a803-8a29be8f0f4b', '3fc4644a-2501-4281-a240-59198703c702', 'Champiñones', 0.00, true, 6, '2026-10-08 01:30:21.383368+00'),
	('f2c1aee2-85b7-4eac-bd03-c992466262b0', '3fc4644a-2501-4281-a240-59198703c702', 'Ananá', 0.00, true, 7, '2026-10-08 01:30:21.383368+00'),
	('4baedc86-b612-4a61-b2d1-4289588d5880', '3fc4644a-2501-4281-a240-59198703c702', 'Longaniza', 0.00, true, 8, '2026-10-08 01:30:21.383368+00'),
	('ef624d79-883e-444e-a295-a006a6c6623a', '3fc4644a-2501-4281-a240-59198703c702', 'Huevo', 0.00, true, 9, '2026-10-08 01:30:21.383368+00'),
	('3e46fe95-cb32-451a-a8d4-235e7438be31', '3fc4644a-2501-4281-a240-59198703c702', 'Cheddar', 0.00, true, 10, '2026-10-08 01:30:21.383368+00'),
	('86a8a495-02e8-483d-9010-8cf48a795276', '3fc4644a-2501-4281-a240-59198703c702', 'Roquefort', 0.00, true, 11, '2026-10-08 01:30:21.383368+00');


--
-- Data for Name: variantes_producto; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."variantes_producto" ("id", "producto_id", "nombre", "precio", "disponible", "orden", "creado_en") VALUES
	('ae55d283-fa4d-4d5e-b913-b70e82a3ee93', '935e7198-2776-4477-a721-e82d9fda1880', 'Con dos gustos', 220.00, true, 3, '2026-10-07 23:41:39.531889+00'),
	('57d979ff-8e9e-4428-9939-614b121a083e', 'e815895b-ab00-4ad0-9892-15a01cfcee07', 'Común', 250.00, true, 1, '2026-10-07 23:41:39.531889+00'),
	('10fe5742-8b10-4c2e-9f25-79eca203d559', 'e815895b-ab00-4ad0-9892-15a01cfcee07', 'Con un gusto', 280.00, true, 2, '2026-10-07 23:41:39.531889+00'),
	('71f48173-eaab-4795-916c-882d57b7a6c0', 'e815895b-ab00-4ad0-9892-15a01cfcee07', 'Con dos gustos', 310.00, true, 3, '2026-10-07 23:41:39.531889+00'),
	('d3698130-97b2-476b-bf1b-fd59e64e4f0e', '8ff62476-5ddf-4b17-81b6-b4db3b5fd36f', 'Para uno', 570.00, true, 1, '2026-10-07 23:48:10.934842+00'),
	('40743e4d-3e80-428d-b00c-b9f2590934e1', '8ff62476-5ddf-4b17-81b6-b4db3b5fd36f', 'Para dos', 1050.00, true, 2, '2026-10-07 23:48:10.934842+00'),
	('1142963a-320b-46fe-bb41-5ab7ee95bcec', 'f95d199b-121d-45fb-ace6-48fb95afe176', 'Para uno', 570.00, true, 1, '2026-10-07 23:48:10.934842+00'),
	('5d82fded-29e6-4b42-8208-998de7140a37', 'f95d199b-121d-45fb-ace6-48fb95afe176', 'Para dos', 1050.00, true, 2, '2026-10-07 23:48:10.934842+00'),
	('25a7a9a3-0e30-4213-8aae-712dace6495d', '2910125f-bdba-425c-bd23-dff8b1760cd1', 'Para uno', 570.00, true, 1, '2026-10-07 23:48:10.934842+00'),
	('44733a4c-7f18-4ea7-9f28-053fc9aefb9d', '2910125f-bdba-425c-bd23-dff8b1760cd1', 'Para dos', 1050.00, true, 2, '2026-10-07 23:48:10.934842+00'),
	('bd260c7c-0c6f-459b-a6e8-1ecf8796263c', 'f3ab2971-2ce8-485c-9b3c-5927784aa9e7', 'Para uno', 570.00, true, 1, '2026-10-07 23:48:10.934842+00'),
	('95dbf04f-b15b-45bc-b9d1-5a3dce29a7b7', 'f3ab2971-2ce8-485c-9b3c-5927784aa9e7', 'Para dos', 1050.00, true, 2, '2026-10-07 23:48:10.934842+00'),
	('278888eb-ba92-4f12-9d9a-78a0cb260bcb', 'f3c3c37d-81ae-427e-977a-5d733f90a955', 'Para uno', 570.00, true, 1, '2026-10-07 23:48:10.934842+00'),
	('33424a30-c718-45d5-86f1-3a05a561aa70', 'f3c3c37d-81ae-427e-977a-5d733f90a955', 'Para dos', 1050.00, true, 2, '2026-10-07 23:48:10.934842+00'),
	('a0843d4b-05c5-4f8a-982c-b136f52d5800', 'c47bc0c2-314d-435f-8e05-403f19103291', 'Para uno', 570.00, true, 1, '2026-10-07 23:48:10.934842+00'),
	('cf5cd17c-9b32-4574-8bb6-fb68c3712560', 'c47bc0c2-314d-435f-8e05-403f19103291', 'Para dos', 1050.00, true, 2, '2026-10-07 23:48:10.934842+00'),
	('744afba6-8df6-44f0-a4ad-5b81c5697141', '9324f709-4629-496c-a10a-f27c2a95f4af', 'Para uno', 570.00, true, 1, '2026-10-07 23:48:10.934842+00'),
	('1b36ef08-3e1c-40a2-a1da-2a260b862586', '9324f709-4629-496c-a10a-f27c2a95f4af', 'Para dos', 1050.00, true, 2, '2026-10-07 23:48:10.934842+00'),
	('b66f0097-d78e-43ce-9ac1-6238bdbc60a0', 'e7f75864-c383-4b05-93ca-5313b7aaf285', 'Para uno', 390.00, true, 1, '2026-10-07 23:48:10.934842+00'),
	('bafea67c-4f08-460d-97bd-9aeab39c4ce4', 'e7f75864-c383-4b05-93ca-5313b7aaf285', 'Para dos', 650.00, true, 2, '2026-10-07 23:48:10.934842+00'),
	('22a66b14-3909-4536-829a-c7dacdafcb72', 'ed9bea68-a9fc-4b97-8cde-2d69de0ead43', 'Para uno', 390.00, true, 1, '2026-10-07 23:48:10.934842+00'),
	('326cd236-907a-4cef-993f-e5cba980d31e', 'ed9bea68-a9fc-4b97-8cde-2d69de0ead43', 'Para dos', 650.00, true, 2, '2026-10-07 23:48:10.934842+00'),
	('6d362cc5-9bbf-4aee-b370-6dd4f826ae60', '7d0906a7-6caf-4b92-82df-55c1301856a5', 'Para uno', 390.00, true, 1, '2026-10-07 23:48:10.934842+00'),
	('eca34baa-99e0-41f8-8132-8f5f62b4d46d', '7d0906a7-6caf-4b92-82df-55c1301856a5', 'Para dos', 650.00, true, 2, '2026-10-07 23:48:10.934842+00'),
	('66575fc2-6361-46e7-92e4-2677b7784035', '5203d60b-dfce-43ce-9aae-c32344564e8f', 'Para uno', 390.00, true, 1, '2026-10-07 23:48:10.934842+00'),
	('3becef55-5338-485b-9222-a7ab1abec928', '5203d60b-dfce-43ce-9aae-c32344564e8f', 'Para dos', 650.00, true, 2, '2026-10-07 23:48:10.934842+00'),
	('8e558f4e-8d16-4424-babc-ef82e92618d7', '558c0ef4-50e7-4bb8-ae75-63993d130597', 'Para uno', 390.00, true, 1, '2026-10-07 23:48:10.934842+00'),
	('db5e7cf5-d6fe-4ec9-a24a-2ea4bf728b61', '558c0ef4-50e7-4bb8-ae75-63993d130597', 'Para dos', 650.00, true, 2, '2026-10-07 23:48:10.934842+00'),
	('3a8e10aa-1b8c-4131-80c4-f18ef39e2fb7', '4443f27d-ee24-4988-b5db-7990fab114ab', 'Común', 650.00, true, 1, '2026-10-10 02:58:46.53384+00'),
	('2d57b7f3-3e72-440a-bb6c-b3bdfec8ead3', '4443f27d-ee24-4988-b5db-7990fab114ab', 'Con muzza', 800.00, true, 2, '2026-10-10 02:58:46.53384+00'),
	('59e41717-3e3b-4a73-b284-c19139464969', '935e7198-2776-4477-a721-e82d9fda1880', 'Común', 160.00, true, 1, '2026-10-07 23:41:39.531889+00'),
	('ebc5eeab-52fb-4fab-8db6-3d139749adc7', '935e7198-2776-4477-a721-e82d9fda1880', 'Con un gusto', 190.00, true, 2, '2026-10-07 23:41:39.531889+00');


--
-- Data for Name: reglas_opciones_variante; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."reglas_opciones_variante" ("id", "variante_id", "grupo_id", "minimo", "maximo", "activo", "producto_id") VALUES
	('b388d678-3ec7-4c50-8ec6-8c1d0edd713f', '59e41717-3e3b-4a73-b284-c19139464969', '42572a56-58d5-48dc-9005-2dbd48bab56b', 0, 0, true, '935e7198-2776-4477-a721-e82d9fda1880'),
	('10f380bf-a57c-4e93-89ce-ca46cdfcb0d5', '57d979ff-8e9e-4428-9939-614b121a083e', '3fc4644a-2501-4281-a240-59198703c702', 0, 0, true, 'e815895b-ab00-4ad0-9892-15a01cfcee07'),
	('1cb22289-8559-4a76-af2d-27d350acdc97', 'ebc5eeab-52fb-4fab-8db6-3d139749adc7', '42572a56-58d5-48dc-9005-2dbd48bab56b', 1, 1, true, '935e7198-2776-4477-a721-e82d9fda1880'),
	('8f1b40ad-100d-4b31-8c96-ffaac2ec2be5', '10fe5742-8b10-4c2e-9f25-79eca203d559', '3fc4644a-2501-4281-a240-59198703c702', 1, 1, true, 'e815895b-ab00-4ad0-9892-15a01cfcee07'),
	('c33b1a2f-0274-4421-ae9c-76099f1ba876', 'ae55d283-fa4d-4d5e-b913-b70e82a3ee93', '42572a56-58d5-48dc-9005-2dbd48bab56b', 2, 2, true, '935e7198-2776-4477-a721-e82d9fda1880'),
	('db93c421-a443-4382-82e6-be51fcae0840', '71f48173-eaab-4795-916c-882d57b7a6c0', '3fc4644a-2501-4281-a240-59198703c702', 2, 2, true, 'e815895b-ab00-4ad0-9892-15a01cfcee07');


--
-- PostgreSQL database dump complete
--

-- \unrestrict LL9rmsdugpO8JRAXitk9nc2BUBL4KHcdJSNnd6k4ZxqMAF9QkcfHPmt2aycXZwu

RESET ALL;

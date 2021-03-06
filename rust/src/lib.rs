#![feature(result_flattening)]
#![feature(proc_macro_hygiene, decl_macro)]
#[macro_use]
extern crate log;
/**
 * Copyright [2020] [Dario Alessandro Lencina Talarico]
 * Licensed under the Apache License, Version 2.0 (the "License");
 * y ou may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 * http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
#[macro_use]
extern crate rocket;
#[macro_use]
extern crate rocket_contrib;
#[macro_use(lazy_static)]
extern crate lazy_static;
extern crate redis;
extern crate rocket_sentry_logger;

pub mod constants;
pub mod controllers;
pub mod db;
pub mod lang;
pub mod messaging;
pub mod model;
pub mod server;
pub mod utils;

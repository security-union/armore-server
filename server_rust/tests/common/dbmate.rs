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
 use std::process::{Command, ExitStatus};

 use lib::db::get_database_url;
 
 pub fn dbmate_rebuild() {
     let url = get_database_url();
     let do_steps = || -> Result<(), ExitStatus> {
         Command::new("dbmate")
             .arg("drop")
             .env("DATABASE_URL", &url)
             .status()
             .expect("failed to execute process");
         Command::new("dbmate")
             .arg("up")
             .env("DATABASE_URL", &url)
             .status()
             .expect("failed to execute process");
         Command::new("dbmate")
             .arg("wait")
             .env("DATABASE_URL", url)
             .status()
             .expect("failed to execute process");
         Ok(())
     };
     if let Err(err) = do_steps() {
         println!("Failed to perform db operation {}", err.to_string());
         dbmate_rebuild();
     }
 }
 
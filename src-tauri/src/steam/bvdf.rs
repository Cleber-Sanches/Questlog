use crate::error::{AppError, AppResult};
use serde_json::{Map, Number, Value};
use std::collections::HashMap;

const TYPE_NONE: u8 = 0x00;
const TYPE_STRING: u8 = 0x01;
const TYPE_INT32: u8 = 0x02;
const TYPE_FLOAT32: u8 = 0x03;
const TYPE_POINTER: u8 = 0x04;
const TYPE_WIDESTRING: u8 = 0x05;
const TYPE_COLOR: u8 = 0x06;
const TYPE_UINT64: u8 = 0x07;
const TYPE_END: u8 = 0x08;
const TYPE_INT64: u8 = 0x0A;
const TYPE_END_ALT: u8 = 0x0B;

struct Reader<'a> {
    buf: &'a [u8],
    offset: usize,
}

impl<'a> Reader<'a> {
    fn new(buf: &'a [u8]) -> Self {
        Self { buf, offset: 0 }
    }

    fn read_u8(&mut self) -> AppResult<u8> {
        if self.offset >= self.buf.len() {
            return Err(AppError::from("BVDF truncado"));
        }
        let v = self.buf[self.offset];
        self.offset += 1;
        Ok(v)
    }

    fn read_bytes(&mut self, n: usize) -> AppResult<&'a [u8]> {
        if self.offset + n > self.buf.len() {
            return Err(AppError::from("BVDF truncado"));
        }
        let slice = &self.buf[self.offset..self.offset + n];
        self.offset += n;
        Ok(slice)
    }

    fn read_cstring(&mut self) -> AppResult<String> {
        let start = self.offset;
        while self.offset < self.buf.len() && self.buf[self.offset] != 0 {
            self.offset += 1;
        }
        if self.offset >= self.buf.len() {
            return Err(AppError::from("BVDF string sem terminador"));
        }
        let s = String::from_utf8_lossy(&self.buf[start..self.offset]).into_owned();
        self.offset += 1;
        Ok(s)
    }

    fn read_object(&mut self) -> AppResult<Map<String, Value>> {
        let mut obj = Map::new();
        loop {
            if self.offset >= self.buf.len() {
                return Ok(obj);
            }
            let ty = self.read_u8()?;
            if ty == TYPE_END || ty == TYPE_END_ALT {
                return Ok(obj);
            }
            let key = self.read_cstring()?;
            let value = match ty {
                TYPE_NONE => Value::Object(self.read_object()?),
                TYPE_STRING | TYPE_WIDESTRING => Value::String(self.read_cstring()?),
                TYPE_INT32 | TYPE_POINTER | TYPE_COLOR => {
                    let bytes = self.read_bytes(4)?;
                    let n = i32::from_le_bytes([bytes[0], bytes[1], bytes[2], bytes[3]]);
                    Value::Number(Number::from(n))
                }
                TYPE_FLOAT32 => {
                    let bytes = self.read_bytes(4)?;
                    let n = f32::from_le_bytes([bytes[0], bytes[1], bytes[2], bytes[3]]);
                    Number::from_f64(n as f64)
                        .map(Value::Number)
                        .unwrap_or(Value::Null)
                }
                TYPE_UINT64 => {
                    let bytes = self.read_bytes(8)?;
                    let n = u64::from_le_bytes([
                        bytes[0], bytes[1], bytes[2], bytes[3], bytes[4], bytes[5], bytes[6],
                        bytes[7],
                    ]);
                    Value::Number(Number::from(n))
                }
                TYPE_INT64 => {
                    let bytes = self.read_bytes(8)?;
                    let n = i64::from_le_bytes([
                        bytes[0], bytes[1], bytes[2], bytes[3], bytes[4], bytes[5], bytes[6],
                        bytes[7],
                    ]);
                    Value::Number(Number::from(n))
                }
                other => {
                    return Err(AppError::Message(format!(
                        "Tipo BVDF desconhecido 0x{other:x}"
                    )));
                }
            };
            obj.insert(key, value);
        }
    }
}

pub fn parse(buf: &[u8]) -> AppResult<HashMap<String, Value>> {
    let mut reader = Reader::new(buf);
    let map = reader.read_object()?;
    Ok(map.into_iter().collect())
}
